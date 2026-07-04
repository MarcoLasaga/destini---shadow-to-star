import { motion } from 'framer-motion'
import { Settings, ArrowRight, CircleDot } from 'lucide-react'
import { useWardrobe } from '../../context/WardrobeContext'

const FF = 'Baloo Tamma 2, sans-serif'
const FH = 'Bagel Fat One, cursive'

const C = {
  bg:      '#faf7f2',
  card:    '#fffcf8',
  border:  'rgba(160,120,70,0.15)',
  heading: '#2b1f0e',
  body:    '#5c4a35',
  muted:   '#9c866c',
  accent:  '#756e9e',
  gold:    '#ffd586',
  alt:     '#f3eee5',
  orange:  '#e07020',
}

// ── Shared card ────────────────────────────────────────────────────────────────
function Card({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay }}
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 15, padding: '26px 28px', marginBottom: 20 }}
    >
      {children}
    </motion.div>
  )
}

// ── Section heading inside a card ──────────────────────────────────────────────
function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 19, color: C.heading, marginBottom: 10 }}>
      {children}
    </div>
  )
}

// ── Bullet item ────────────────────────────────────────────────────────────────
function Bullet({ text, orange }: { text: React.ReactNode; orange?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 7 }}>
      <CircleDot size={13} style={{ color: orange ? C.orange : C.muted, flexShrink: 0, marginTop: 3 }} />
      <span style={{ fontFamily: FF, fontSize: 13.5, color: C.body, lineHeight: 1.55 }}>{text}</span>
    </div>
  )
}

// ── Sub-section inside a card (label + value + bullets) ───────────────────────
function SubSection({
  label, value, bullets, borderTop = true,
}: { label: string; value?: string; bullets: string[]; borderTop?: boolean }) {
  return (
    <div style={{ padding: '16px 0', borderTop: borderTop ? `1px solid ${C.border}` : 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: C.body }}>{label}</span>
        {value && <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: C.muted }}>{value}</span>}
      </div>
      {bullets.map((b, i) => <Bullet key={i} text={`· ${b}`} />)}
    </div>
  )
}

// ── Mock sample outputs (in real app these come from the outfit generator) ─────
const SAMPLE_OUTPUTS = [
  {
    title: 'Casual everyday Look',
    score: 70,
    items: ['White Polo (top)', 'Oversize jeans (bottom)', 'Troy Shoes (shoes)'],
    style: 'casual',
    occasion: 'everyday',
    reasons: ['Great color combination', 'Cohesive casual look', 'Great for everyday', 'Matches your style preferences', 'Comfortable for warm weather', 'Neutrals anchor the blue accent'],
  },
]

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Recommendations() {
  const { items } = useWardrobe()

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      style={{ padding: '32px 32px 80px', background: C.bg, minHeight: '100vh' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: FH, fontSize: 34, color: C.heading, marginBottom: 6 }}>
          Recommendation Transparency
        </h1>
        <p style={{ fontFamily: FF, fontSize: 14, color: C.muted }}>
          Algorithm explainability for system evaluation and thesis defense
        </p>
      </div>

      {/* ── Hybrid Recommendation Model ────────────────────────────────────── */}
      <Card delay={0.06}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Settings size={19} style={{ color: C.orange }} />
          <CardTitle>Hybrid Recommendation Model</CardTitle>
        </div>

        <p style={{ fontFamily: FF, fontSize: 14, color: C.body, lineHeight: 1.65, marginBottom: 22, maxWidth: 820 }}>
          StyleSense uses a <strong>hybrid recommendation engine</strong> combining Content-Based Filtering and
          Collaborative Filtering to generate outfit suggestions from the user's personal wardrobe.
          The hybrid score determines the final ranking of each outfit.
        </p>

        {/* IPO flow */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 8, alignItems: 'stretch' }}>
          {/* INPUT */}
          <div style={{ background: C.alt, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 18px' }}>
            <div style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: C.orange, marginBottom: 14 }}>INPUT</div>
            {['User wardrobe items', 'User style preferences', 'Favorite colors', 'Occasion preference', 'Clothing attributes (color, fabric, style)'].map((t, i) => (
              <Bullet key={i} text={t} orange />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
            <ArrowRight size={22} style={{ color: C.muted }} />
          </div>

          {/* PROCESS */}
          <div style={{ background: C.alt, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 18px' }}>
            <div style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: C.orange, marginBottom: 14 }}>PROCESS</div>
            {['Generate item combinations (Top+Bottom+Shoes)', 'Content-Based scoring (color, style, occasion)', 'Collaborative scoring (cosine similarity)', 'Hybrid score = CB×0.55 + CF×0.45', 'Rank & deduplicate results'].map((t, i) => (
              <Bullet key={i} text={t} orange />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
            <ArrowRight size={22} style={{ color: C.muted }} />
          </div>

          {/* OUTPUT */}
          <div style={{ background: C.alt, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 18px' }}>
            <div style={{ fontFamily: FF, fontSize: 10.5, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: C.orange, marginBottom: 14 }}>OUTPUT</div>
            {['Ranked outfit suggestions', 'Score with reasoning text', 'Outfit name & occasion label', 'Save & wear tracking'].map((t, i) => (
              <Bullet key={i} text={t} orange />
            ))}
          </div>
        </div>
      </Card>

      {/* ── CB + CF cards ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}
        className="admin-chart-grid"
      >
        {/* Content-Based Filtering */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.14 }}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 15, padding: '26px 28px' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: C.heading }}>Content-Based Filtering</div>
            <span style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.orange }}>55% weight</span>
          </div>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 4, lineHeight: 1.55 }}>
            Scores outfits by analyzing clothing attributes and matching against user preferences.
          </p>

          <SubSection label="Color Harmony" value="25% of CB score" borderTop={false}
            bullets={[
              'Neutral colors (Black, White, Gray, Navy) = universal match',
              'Same color group (warm/cool/pastel) = 0.85 score',
              'Mixed warm + cool without neutrals = 0.4 penalty',
            ]}
          />
          <SubSection label="Style Consistency" value="25% of CB score"
            bullets={[
              'All items same style = 1.0',
              'Score = 1 / number of unique styles',
            ]}
          />
          <SubSection label="Occasion Match" value="25% of CB score"
            bullets={[
              'Proportion of items matching target occasion',
              'All matching = 1.0; partial match = proportional',
            ]}
          />
          <SubSection label="User Preference Alignment" value="25% of CB score"
            bullets={[
              "Matches items against user's preferred styles and favorite colors",
            ]}
          />
        </motion.div>

        {/* Collaborative Filtering */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: 0.18 }}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 15, padding: '26px 28px' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontFamily: FF, fontWeight: 800, fontSize: 18, color: C.heading }}>Collaborative Filtering</div>
            <span style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.orange }}>45% weight</span>
          </div>
          <p style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 4, lineHeight: 1.55 }}>
            Compares user preferences with community patterns using cosine similarity to boost proven combinations.
          </p>

          <SubSection label="Similarity Metric" value="Cosine Similarity" borderTop={false}
            bullets={[
              'Builds style vector (8 dimensions: casual, formal, sporty, etc.)',
              'Computes dot product / (magnitude_A × magnitude_B)',
              'Threshold: similarity > 0.1 to consider pattern',
            ]}
          />
          <SubSection label="Community Patterns" value="5 simulated users"
            bullets={[
              'Alex (casual/streetwear), Jordan (formal/classic)',
              'Sam (casual/minimalist), Taylor (sporty/casual)',
              'Morgan (bohemian/vintage)',
            ]}
          />
          <SubSection label="Pattern Matching" value="Category + Style overlap"
            bullets={[
              'Category overlap: 30% weight',
              'Style overlap: 70% weight',
              'Score multiplied by user similarity',
            ]}
          />
          <div style={{ padding: '14px 0 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: FF, fontSize: 14.5, fontWeight: 700, color: C.body }}>Formula</span>
              <span style={{ fontFamily: FF, fontSize: 13.5, fontWeight: 700, color: C.muted }}>
                Σ(pattern_score × similarity) / Σ(similarity)
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── System Configuration ────────────────────────────────────────────── */}
      <Card delay={0.22}>
        <CardTitle>System Configuration</CardTitle>

        {/* 3-column grid of spec rows */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 0 }}>
          {/* Row 1 */}
          <div style={{ padding: '13px 0', borderBottom: `1px solid ${C.border}`, paddingRight: 24 }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Approach</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>Hybrid (CB + CF)</div>
          </div>
          <div style={{ padding: '13px 24px', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Content-Based Weight</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>55%</div>
          </div>
          <div style={{ padding: '13px 0 13px 24px', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Collaborative Weight</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>45%</div>
          </div>

          {/* Row 2 */}
          <div style={{ padding: '13px 0', borderBottom: `1px solid ${C.border}`, paddingRight: 24 }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Similarity Metric</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>Cosine Similarity</div>
          </div>
          <div style={{ padding: '13px 24px', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Color Harmony</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>Group-based scoring (neutral/warm/cool/pastel)</div>
          </div>
          <div style={{ padding: '13px 0 13px 24px', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Community Patterns</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>5 simulated user profiles</div>
          </div>

          {/* Row 3 */}
          <div style={{ padding: '13px 0', borderBottom: `1px solid ${C.border}`, paddingRight: 24 }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Outfit Structure</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>Top + Bottom + Shoes + optional Outerwear</div>
          </div>
          <div style={{ padding: '13px 24px', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Scoring Range</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>0.0 – 1.0</div>
          </div>
          <div style={{ padding: '13px 0 13px 24px', borderBottom: `1px solid ${C.border}`, borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Deduplication</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>Item-ID based unique filtering</div>
          </div>

          {/* Row 4 */}
          <div style={{ padding: '13px 0 0', paddingRight: 24 }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Data Storage</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>localStorage (client-side)</div>
          </div>
          <div style={{ padding: '13px 24px 0', borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Total Recommendations</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>1</div>
          </div>
          <div style={{ padding: '13px 0 0 24px', borderLeft: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 5 }}>Wardrobe Items in System</div>
            <div style={{ fontFamily: FF, fontSize: 14, fontWeight: 700, color: C.heading }}>{items.length}</div>
          </div>
        </div>
      </Card>

      {/* ── Sample Recommendation Outputs ──────────────────────────────────── */}
      <Card delay={0.28}>
        <CardTitle>Sample Recommendation Outputs</CardTitle>
        <p style={{ fontFamily: FF, fontSize: 13.5, color: C.muted, marginBottom: 20 }}>
          Recent saved outfits with their scoring details
        </p>

        {SAMPLE_OUTPUTS.map((out, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, delay: 0.34 + i * 0.08 }}
            style={{ background: C.alt, border: `1px solid ${C.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: FF, fontSize: 15.5, fontWeight: 700, color: C.heading }}>{out.title}</div>
              <span style={{
                fontFamily: FF, fontSize: 12.5, fontWeight: 700,
                background: 'rgba(255,213,134,0.35)', color: C.orange,
                borderRadius: 30, padding: '4px 13px',
              }}>
                Score: {out.score}%
              </span>
            </div>

            {/* Item pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {out.items.map((item, j) => (
                <span key={j} style={{
                  fontFamily: FF, fontSize: 12.5, fontWeight: 600,
                  background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 99, padding: '4px 13px', color: C.body,
                }}>
                  {item}
                </span>
              ))}
            </div>

            {/* Reason line */}
            <p style={{ fontFamily: FF, fontSize: 13, color: C.body, lineHeight: 1.55, margin: 0 }}>
              <strong>Style:</strong> {out.style} ·{' '}
              <strong>Occasion:</strong> {out.occasion} ·{' '}
              <strong>Reason:</strong> {out.reasons.join(' · ')}
            </p>
          </motion.div>
        ))}

        {SAMPLE_OUTPUTS.length === 0 && (
          <p style={{ fontFamily: FF, fontSize: 13.5, color: C.muted }}>No saved outfits yet.</p>
        )}
      </Card>

      <style>{`
        @media (max-width: 900px) {
          .admin-chart-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </motion.div>
  )
}