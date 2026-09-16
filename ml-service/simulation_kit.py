"""StyleSense Algorithm Simulation & Pen-and-Paper Defense Kit.

This script demonstrates and outputs exact, reproducible step-by-step mathematical
simulations for both core algorithms in the StyleSense System Pipeline:
1. CNN Image Classification (Toy Kernel Convolution, ReLU, Max-Pooling, Softmax)
2. K-Means Clustering & Tabular Recommendation (8-row sample, One-Hot Encoding,
   80/20 Train-Test split, Euclidean Distance, Centroid Recalculation, Accuracy).
"""

import math
from typing import Dict, List, Tuple


def print_section(title: str) -> None:
    border = "=" * 80
    print(f"\n{border}\n {title.upper()}\n{border}\n")


# ==============================================================================
# PART 1: TABULAR PREPROCESSING & K-MEANS / RECOMMENDATION (8-ROW PEN & PAPER)
# ==============================================================================

# 8 representative wardrobe items matching StyleSense schema
RAW_DATASET_8_ROWS = [
    {"id": "W01", "name": "White Oxford Shirt", "category": "TOP", "color": "White", "style": "FORMAL", "laundry": "CLEAN"},
    {"id": "W02", "name": "Graphic Band Tee", "category": "TOP", "color": "Black", "style": "CASUAL", "laundry": "CLEAN"},
    {"id": "W03", "name": "Blue Slim Chinos", "category": "BOTTOM", "color": "Blue", "style": "FORMAL", "laundry": "CLEAN"},
    {"id": "W04", "name": "Black Cargo Joggers", "category": "BOTTOM", "color": "Black", "style": "CASUAL", "laundry": "CLEAN"},
    {"id": "W05", "name": "Leather Derby Shoes", "category": "SHOES", "color": "Brown", "style": "FORMAL", "laundry": "CLEAN"},
    {"id": "W06", "name": "Running Sneakers", "category": "SHOES", "color": "White", "style": "CASUAL", "laundry": "CLEAN"},
    {"id": "W07", "name": "Tailored Blazer", "category": "OUTERWEAR", "color": "Navy", "style": "FORMAL", "laundry": "CLEAN"},
    {"id": "W08", "name": "Oversized Hoodie", "category": "OUTERWEAR", "color": "Gray", "style": "CASUAL", "laundry": "CLEAN"},
]


def simulate_tabular_preprocessing_and_kmeans():
    print_section("Part 1: 8-Row Tabular Data Preprocessing & K-Means Simulation")

    print("--- STEP 1 & 6: Data Cleaning & Feature Selection ---")
    print("Raw Columns: [id, name, category, color, style, laundry]")
    print("Removed columns: 'id' (identifier), 'name' (text), 'laundry' (metadata).")
    print("Selected Factors (Features) for Model: [category, style, color_is_neutral]\n")

    print("--- STEP 2 & 7: Data Preprocessing (Binary / One-Hot Encoding) ---")
    print("We convert categorical features into numeric 0s and 1s vector space:")
    print("Feature Encoding Scheme:")
    print("  - Category: is_TOP (0/1), is_BOTTOM (0/1), is_SHOES (0/1), is_OUTERWEAR (0/1)")
    print("  - Style: is_FORMAL (1=Formal, 0=Casual)")
    print("  - Color: is_NEUTRAL (1=Black/White/Gray/Navy, 0=Other)")
    print("  Vector: [is_TOP, is_BOTTOM, is_SHOES, is_OUTER, is_FORMAL, is_NEUTRAL]\n")

    # One-hot encoded vectors (6-dimensional)
    neutrals = {"White", "Black", "Navy", "Gray"}
    encoded_rows = []
    for item in RAW_DATASET_8_ROWS:
        cat = item["category"]
        vec = [
            1 if cat == "TOP" else 0,
            1 if cat == "BOTTOM" else 0,
            1 if cat == "SHOES" else 0,
            1 if cat == "OUTERWEAR" else 0,
            1 if item["style"] == "FORMAL" else 0,
            1 if item["color"] in neutrals else 0,
        ]
        encoded_rows.append((item["id"], item["name"], item["style"], vec))

    print(f"{'ID':<5} | {'Item Name':<22} | {'Style (Target)':<14} | {'Preprocessed Vector [x1..x6]'}")
    print("-" * 75)
    for row_id, name, target, vec in encoded_rows:
        print(f"{row_id:<5} | {name:<22} | {target:<14} | {vec}")

    print("\n--- STEP 4 & 8: Train-Test Split (80% Train, 20% Test) ---")
    print("Total rows = 8. Train (80% = 6 rows: W01-W06), Test (20% = 2 rows: W07-W08)\n")

    train_set = encoded_rows[:6]
    test_set = encoded_rows[6:]

    print("Training Set (6 rows):", [r[0] for r in train_set])
    print("Testing Set (2 rows):", [r[0] for r in test_set])

    print("\n--- STEP 9: K-Means Clustering Simulation (K = 2: Formal vs Casual Cluster) ---")
    print("Initial Cluster Centroids (seeded from W01 and W02):")
    c1 = list(train_set[0][3])  # W01: [1, 0, 0, 0, 1, 1] (Formal Top)
    c2 = list(train_set[1][3])  # W02: [1, 0, 0, 0, 0, 1] (Casual Top)
    print(f"  Centroid C1 (Formal Seed): {c1}")
    print(f"  Centroid C2 (Casual Seed): {c2}\n")

    print("Euclidean Distance Formula: d(x, C) = sqrt( sum( (x_i - C_i)^2 ) )")
    print("\nCalculating Distances for Training Set (Iteration 1):")
    
    clusters = {1: [], 2: []}
    for row_id, name, _, vec in train_set:
        d1 = math.sqrt(sum((v - c)**2 for v, c in zip(vec, c1)))
        d2 = math.sqrt(sum((v - c)**2 for v, c in zip(vec, c2)))
        assigned = 1 if d1 <= d2 else 2
        clusters[assigned].append(row_id)
        print(f"  {row_id}: d(x, C1)={d1:.3f}, d(x, C2)={d2:.3f} => Assigned to Cluster {assigned}")

    print(f"\nIteration 1 Cluster Assignments: Cluster 1 = {clusters[1]}, Cluster 2 = {clusters[2]}")

    # Recalculate Centroids
    print("\nUpdating Centroids C_k = (1 / N_k) * sum(x_i):")
    new_c1 = [0.0] * 6
    for row_id in clusters[1]:
        vec = next(r[3] for r in train_set if r[0] == row_id)
        for i in range(6):
            new_c1[i] += vec[i]
    new_c1 = [round(v / len(clusters[1]), 2) for v in new_c1]

    new_c2 = [0.0] * 6
    for row_id in clusters[2]:
        vec = next(r[3] for r in train_set if r[0] == row_id)
        for i in range(6):
            new_c2[i] += vec[i]
    new_c2 = [round(v / len(clusters[2]), 2) for v in new_c2]

    print(f"  Updated Centroid C1 (Formal Style Group): {new_c1}")
    print(f"  Updated Centroid C2 (Casual Style Group): {new_c2}")

    print("\n--- STEP 10: Testing on 20% Test Data & Accuracy Calculation ---")
    correct = 0
    for row_id, name, actual_style, vec in test_set:
        d1 = math.sqrt(sum((v - c)**2 for v, c in zip(vec, new_c1)))
        d2 = math.sqrt(sum((v - c)**2 for v, c in zip(vec, new_c2)))
        predicted_cluster = 1 if d1 <= d2 else 2
        predicted_style = "FORMAL" if predicted_cluster == 1 else "CASUAL"
        is_correct = (predicted_style == actual_style)
        if is_correct:
            correct += 1
        print(f"  Test Item {row_id} ({name}):")
        print(f"    Vector: {vec}")
        print(f"    d(x, C1) = {d1:.3f}, d(x, C2) = {d2:.3f}")
        print(f"    Predicted: Cluster {predicted_cluster} ({predicted_style}) | Actual: {actual_style} | Result: {'CORRECT' if is_correct else 'INCORRECT'}")

    accuracy = (correct / len(test_set)) * 100
    print(f"\nSimulation Accuracy on Test Set: {correct}/{len(test_set)} = {accuracy:.1f}%\n")


# ==============================================================================
# PART 2: CNN TOY MATRIX SIMULATION (PEN & PAPER MATH STEP-BY-STEP)
# ==============================================================================

def simulate_cnn_toy_pass():
    print_section("Part 2: CNN Image Classification Pen & Paper Simulation")

    print("In PyTorch/ResNet-50, images are preprocessed and fed into Convolutional layers.")
    print("For pen-and-paper defense, we simulate a 4x4 input pixel patch with a 3x3 filter.\n")

    # Step 1: Raw Image & Preprocessing (Min-Max / Standard Normalization)
    raw_pixels = [
        [200, 210, 50, 40],
        [190, 220, 45, 35],
        [20,  30,  180, 200],
        [25,  35,  190, 210],
    ]
    print("--- CNN Step 1: Image Normalization (Preprocessing) ---")
    print("Formula: x_norm = x / 255.0  (Scales pixel values to [0.0, 1.0])")
    norm_pixels = [[round(p / 255.0, 2) for p in row] for row in raw_pixels]
    for row in norm_pixels:
        print("  ", row)

    # Step 2: 3x3 Edge/Feature Kernel Filter
    kernel = [
        [1,  0, -1],
        [1,  0, -1],
        [1,  0, -1]
    ]
    bias = 0.1
    print("\n--- CNN Step 2: 2D Convolution Operation ---")
    print("Kernel Filter (Vertical Edge Detector 3x3):")
    for r in kernel:
        print("  ", r)
    print(f"Bias b = {bias}")
    print("Convolution Formula: Output(i,j) = sum(Input(i+m, j+n) * Kernel(m,n)) + b")

    # Convolution on 4x4 with 3x3 kernel (Stride=1, Valid padding) -> 2x2 Feature Map
    feature_map = []
    for i in range(2):
        row = []
        for j in range(2):
            acc = 0.0
            print(f"\nCalculating Position ({i+1}, {j+1}):")
            terms = []
            for m in range(3):
                for n in range(3):
                    val = norm_pixels[i + m][j + n]
                    w = kernel[m][n]
                    acc += val * w
                    if w != 0:
                        terms.append(f"({val} * {w})")
            acc += bias
            print("  Sum = " + " + ".join(terms) + f" + {bias} = {acc:.3f}")
            row.append(round(acc, 3))
        feature_map.append(row)

    print("\nResulting Feature Map (2x2):")
    for r in feature_map:
        print("  ", r)

    # Step 3: Activation Function (ReLU)
    print("\n--- CNN Step 3: Activation Function (ReLU) ---")
    print("Formula: ReLU(z) = max(0, z)")
    relu_map = [[max(0.0, val) for val in row] for row in feature_map]
    for r in relu_map:
        print("  ", r)

    # Step 4: Max Pooling (2x2 -> 1x1)
    print("\n--- CNN Step 4: Max Pooling (2x2 window) ---")
    print("Formula: Pooled_value = max(window elements)")
    max_pooled = max(max(row) for row in relu_map)
    print(f"  Pooled Feature Value = max({relu_map[0]}, {relu_map[1]}) = {max_pooled:.3f}")

    # Step 5: Fully Connected Layer & Softmax Classification
    print("\n--- CNN Step 5: Fully Connected (FC) Layer & Softmax ---")
    print("Target Categories: [TOP, BOTTOM, SHOES, OUTERWEAR, ACCESSORIES]")
    weights_fc = [1.8, 0.2, -0.5, 0.8, -1.0]
    biases_fc = [0.1, 0.05, 0.0, 0.2, 0.0]
    
    logits = [round(max_pooled * w + b, 3) for w, b in zip(weights_fc, biases_fc)]
    print(f"Logits z_i = (Feature * W_i) + b_i:")
    categories = ['TOP', 'BOTTOM', 'SHOES', 'OUTERWEAR', 'ACCESSORIES']
    for cat, z in zip(categories, logits):
        print(f"  z({cat:<11}) = {z}")

    # Softmax
    exp_z = [math.exp(z) for z in logits]
    sum_exp_z = sum(exp_z)
    probabilities = [round(e / sum_exp_z, 4) for e in exp_z]

    print("\nSoftmax Formula: P(Class_i) = exp(z_i) / sum(exp(z_j))")
    print(f"Denominator sum(exp(z)) = {sum_exp_z:.4f}")
    for cat, prob in zip(categories, probabilities):
        bar = "#" * int(prob * 30)
        print(f"  P({cat:<11}) = {prob:.4f} ({prob*100:5.2f}%) {bar}")

    pred_idx = probabilities.index(max(probabilities))
    print(f"\nFinal Predicted Category: {categories[pred_idx]} (Confidence: {probabilities[pred_idx]*100:.2f}%)\n")


if __name__ == "__main__":
    simulate_tabular_preprocessing_and_kmeans()
    simulate_cnn_toy_pass()

