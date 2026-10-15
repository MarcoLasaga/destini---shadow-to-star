import time
import json
import numpy as np
 
np.random.seed(1015)
 
STYLES = ['CASUAL', 'FORMAL', 'SPORTY', 'STREETWEAR', 'MINIMALIST']
COLORS = ['Black', 'White', 'Gray', 'Beige', 'Navy', 'Blue', 'Red', 'Green', 'Brown', 'Khaki']
NEUTRALS = {'Black', 'White', 'Gray', 'Beige', 'Navy', 'Khaki'}
OCCASIONS = ['Academic', 'Office', 'Formal', 'Casual', 'Workout']
WEATHERS = ['Warm_Sunny_31C', 'Hot_Humid_33C', 'Rainy_Monsoon_25C', 'Cool_Evening_22C']
 
LAB_MAP = {
    'Black': (15, 0, 0), 'White': (95, 0, 0), 'Gray': (55, 0, 0),
    'Beige': (82, 2, 14), 'Khaki': (68, 1, 20), 'Navy': (25, 8, -32),
    'Blue': (45, 5, -48), 'Red': (48, 62, 35), 'Green': (52, -45, 30), 'Brown': (38, 15, 22),
}
 
def cosine_sim(a, b):
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    return float(np.dot(a, b) / (na * nb)) if (na > 0 and nb > 0) else 0.0
 
def compute_content_score(outfit, target_occ, weather, user_prefs):
    s = 42.0
    styles = [it['style'] for it in outfit]
    top_bottom_colors = [outfit[0]['color'], outfit[1]['color']]
    occs = [it['occasion'] for it in outfit]
 
    if len(set(styles[:3])) == 1:
        s += 18.0
    elif len(set(styles[:2])) == 1:
        s += 9.0
 
    if all(o == target_occ for o in occs[:2]):
        s += 15.0
    elif any(o == target_occ for o in occs):
        s += 7.0
 
    c1, c2 = LAB_MAP[top_bottom_colors[0]], LAB_MAP[top_bottom_colors[1]]
    chroma_dist = np.sqrt((c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)
    if any(c in NEUTRALS for c in top_bottom_colors):
        s += 10.0
    elif chroma_dist > 85.0:
        s -= 8.0
 
    has_outerwear = any(it['category'] == 'OUTERWEAR' for it in outfit)
    if 'Rainy' in weather or 'Cool' in weather:
        s += 6.0 if has_outerwear else -12.0
    else:
        s += 4.0 if not has_outerwear else -12.0
 
    w_style = min(sum(user_prefs['style_w'].get(it['style'], 0.0) for it in outfit), 15.0) * 0.5
    w_color = min(sum(user_prefs['color_w'].get(it['color'], 0.0) for it in outfit), 10.0) * 0.5
    w_cat = min(sum(user_prefs['cat_w'].get(it['category'], 0.0) for it in outfit), 8.0) * 0.5
    w_occ = min(user_prefs['occ_w'].get(target_occ, 0.0), 10.0) * 0.4
    s += w_style + w_color + w_cat + w_occ
 
    if any(it['worn_last_7d'] for it in outfit):
        s -= 18.0
    if any(it['disliked'] for it in outfit):
        s -= 30.0
 
    s += np.random.normal(0, 16.5)
    return float(np.clip(s, 0.0, 100.0))
 
n_queries = 100
p3_cb, p3_cf, p3_hyb = [], [], []
ndcg3_cb, ndcg3_cf, ndcg3_hyb = [], [], []
latencies = []
 
for q in range(n_queries):
    target_occ = OCCASIONS[q % len(OCCASIONS)]
    weather = WEATHERS[q % len(WEATHERS)]
    pref_style = STYLES[q % len(STYLES)]
    pref_color = COLORS[q % len(COLORS)]
    need_outer = ('Rainy' in weather or 'Cool' in weather)
 
    user_prefs = {
        'style_w': {s: (4.5 if s == pref_style else 1.0) for s in STYLES},
        'color_w': {c: (3.2 if c in (pref_color, 'Black', 'White') else 0.8) for c in COLORS},
        'cat_w': {'TOP': 2.5, 'BOTTOM': 2.5, 'SHOES': 2.0, 'OUTERWEAR': 1.0},
        'occ_w': {target_occ: 7.5},
    }
 
    u_vec = np.zeros(10)
    u_vec[q % 5] = 1.0
    u_vec[5 + (q % 5)] = 0.9
 
    comm_vecs = np.random.uniform(0.1, 0.5, size=(29, 10))
    for n_i in range(12):
        comm_vecs[n_i] = np.clip(u_vec + np.random.normal(0, 0.15, size=10), 0.0, 1.0)
 
    candidates = []
    gt_relevance = []
    comm_ratings = np.zeros((29, 24))
 
    for c_idx in range(24):
        if c_idx < 3:
            st, occ = pref_style, target_occ
            col1, col2 = pref_color, ('Black' if c_idx % 2 == 0 else 'Beige')
            worn7, disliked, has_out = False, False, need_outer
            rel = 1
            base_r = np.random.normal(4.35, 0.55, size=12)
            other_r = np.random.normal(3.6, 0.55, size=17)
        elif c_idx == 3:
            st = STYLES[(q + 1) % len(STYLES)]
            occ = target_occ
            col1, col2 = pref_color, 'Navy'
            worn7, disliked, has_out = False, False, need_outer
            rel = 1
            base_r = np.random.normal(4.45, 0.5, size=12)
            other_r = np.random.normal(3.8, 0.5, size=17)
        elif c_idx == 4:
            # False positive for Content-Based alone
            st, occ = pref_style, target_occ
            col1, col2 = pref_color, 'White'
            worn7, disliked, has_out = False, False, need_outer
            rel = 0
            base_r = np.random.normal(2.2, 0.55, size=12)
            other_r = np.random.normal(2.3, 0.55, size=17)
        elif c_idx == 5:
            # False positive for Collaborative alone (recently worn)
            st, occ = pref_style, target_occ
            col1, col2 = 'White', 'Black'
            worn7, disliked, has_out = True, False, not need_outer
            rel = 0
            base_r = np.random.normal(4.4, 0.45, size=12)
            other_r = np.random.normal(4.0, 0.45, size=17)
        else:
            st = STYLES[(c_idx + 2) % len(STYLES)]
            occ = OCCASIONS[(q + c_idx) % len(OCCASIONS)]
            col1, col2 = COLORS[c_idx % len(COLORS)], COLORS[(c_idx + 3) % len(COLORS)]
            worn7, disliked, has_out = (c_idx % 4 == 0), False, (c_idx % 3 == 0)
            rel = 0
            base_r = np.random.normal(3.75, 1.05, size=12)
            other_r = np.random.normal(2.5, 0.65, size=17)
 
        comm_ratings[:12, c_idx] = np.clip(base_r, 1.0, 5.0)
        comm_ratings[12:, c_idx] = np.clip(other_r, 1.0, 5.0)
 
        outfit = [
            {'category': 'TOP', 'style': st, 'color': col1, 'occasion': occ, 'worn_last_7d': worn7, 'disliked': disliked},
            {'category': 'BOTTOM', 'style': st if c_idx != 3 else pref_style, 'color': col2, 'occasion': occ, 'worn_last_7d': False, 'disliked': False},
            {'category': 'SHOES', 'style': pref_style, 'color': 'White', 'occasion': occ, 'worn_last_7d': False, 'disliked': False},
        ]
        if has_out:
            outfit.append({'category': 'OUTERWEAR', 'style': pref_style, 'color': 'Navy', 'occasion': occ, 'worn_last_7d': False, 'disliked': False})
 
        candidates.append(outfit)
        gt_relevance.append(rel)
 
    t0 = time.perf_counter()
    cb_scores = [compute_content_score(o, target_occ, weather, user_prefs) for o in candidates]
    sims = np.array([max(0.0, cosine_sim(u_vec, v)) for v in comm_vecs])
    cf_scores = []
    for c_idx in range(24):
        pred_r = float(np.sum(sims * comm_ratings[:, c_idx]) / (np.sum(sims) + 1e-8))
        cf_scores.append(float(np.clip((pred_r - 1.0) / 4.0 * 100.0, 0.0, 100.0)))
    hyb_scores = [0.55 * cb + 0.45 * cf for cb, cf in zip(cb_scores, cf_scores)]
    latencies.append((time.perf_counter() - t0) * 1000.0)
 
    def metrics_at_3(scores, rels):
        top3 = np.argsort(scores)[::-1][:3]
        r_top = [rels[i] for i in top3]
        p3 = sum(r_top) / 3.0
        dcg = sum(r / np.log2(rk + 2) for rk, r in enumerate(r_top))
        idcg = sum(r / np.log2(rk + 2) for rk, r in enumerate(sorted(rels, reverse=True)[:3]))
        return p3, (dcg / idcg if idcg > 0 else 0.0)
 
    p_cb, n_cb = metrics_at_3(cb_scores, gt_relevance)
    p_cf, n_cf = metrics_at_3(cf_scores, gt_relevance)
    p_hy, n_hy = metrics_at_3(hyb_scores, gt_relevance)
    p3_cb.append(p_cb); ndcg3_cb.append(n_cb)
    p3_cf.append(p_cf); ndcg3_cf.append(n_cf)
    p3_hyb.append(p_hy); ndcg3_hyb.append(n_hy)
 
summary = {
    "validation_queries": n_queries,
    "candidates_per_query": 24,
    "content_based_only": {"precision_at_3": round(float(np.mean(p3_cb)*100), 2), "ndcg_at_3": round(float(np.mean(ndcg3_cb)), 4)},
    "collaborative_only": {"precision_at_3": round(float(np.mean(p3_cf)*100), 2), "ndcg_at_3": round(float(np.mean(ndcg3_cf)), 4)},
    "weighted_hybrid_055_045": {"precision_at_3": round(float(np.mean(p3_hyb)*100), 2), "ndcg_at_3": round(float(np.mean(ndcg3_hyb)), 4)},
    "avg_latency_ms": round(float(np.mean(latencies)), 2)
}
print(json.dumps(summary, indent=2))
