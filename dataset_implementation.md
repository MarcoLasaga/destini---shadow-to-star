You are working as the backend/ML engineer for our existing StyleSense system.

IMPORTANT:
DO NOT immediately rewrite, replace, or restructure the existing application.

First inspect the repository thoroughly and understand the existing architecture, database schema, API routes, ML service, Supabase integration, wardrobe collection, recommendation implementation, and current ResNet-50 implementation.

Our goal is to integrate external fashion datasets into the EXISTING StyleSense architecture without breaking existing functionality.

==================================================
PROJECT CONTEXT
==================================================

StyleSense is an image-based wardrobe and outfit recommendation application.

The system has three primary algorithmic components:

1. CNN / ResNet-50
2. K-Means
3. Hybrid Filtering

The intended responsibility of each algorithm is:

CNN / ResNet-50:
    Understand the uploaded clothing image.
    Predict clothing category and relevant visual/semantic attributes.

K-Means:
    Process visual/color feature representations and group similar visual characteristics.
    It must NOT be presented as the outfit recommendation algorithm.
    It is a supporting feature/organization component.

Hybrid Filtering:
    Generate and rank outfit combinations from the user's OWN wardrobe.
    Combine content-based compatibility with collaborative/user-preference signals and contextual constraints such as occasion and weather.

The existing user's wardrobe is already implemented in Supabase.
DO NOT replace the Supabase wardrobe with an external dataset.

==================================================
DATASETS
==================================================

We intend to work with four major sources of data:

A. DeepFashion
B. Polyvore
C. IQON3000
D. Existing StyleSense user wardrobe in Supabase

Each dataset has a DIFFERENT responsibility.

------------------------------------------
A. DEEPFASHION
------------------------------------------

Primary purpose:
CNN training / evaluation and clothing visual understanding.

Use the DeepFashion Category and Attribute Prediction benchmark where appropriate.

Official benchmark information:
- approximately 289,222 clothing images
- 50 clothing categories
- 1,000 clothing attributes
- category annotations
- attribute annotations
- bounding boxes
- train/validation/test partitions

Do NOT automatically download the entire dataset into the repository.

First determine:
1. exact dataset files required
2. storage requirements
3. licensing/access requirements
4. which categories map to our StyleSense taxonomy
5. which attributes are actually useful for StyleSense

Our current StyleSense garment taxonomy is approximately:

- TOP
- BOTTOM
- SHOES
- OUTERWEAR
- ACCESSORIES

Create a documented mapping from DeepFashion categories/attributes to the StyleSense taxonomy.

Do not silently discard categories.
Document which categories are mapped, merged, ignored, or unavailable.

------------------------------------------
B. POLYVORE
------------------------------------------

Primary purpose:
Outfit compatibility evaluation / content-based recommendation support.

The dataset contains outfit compositions and compatibility annotations.

Use it to investigate and support:

    Top + Bottom + Shoes
    Top + Bottom + Shoes + Outerwear

compatibility.

The dataset must NOT be treated as the user's personal wardrobe.

Investigate the available:
- train split
- validation split
- test split
- compatibility labels
- outfit item/category information

The compatibility information should eventually help us evaluate or calibrate the Content-Based portion of StyleSense.

Do not blindly train a new deep recommendation model from Polyvore.

First determine how its item/category representation can map into our existing StyleSense representation.

------------------------------------------
C. IQON3000
------------------------------------------

Primary purpose:
Personalization / collaborative preference modeling.

Investigate the available:
- user identifiers
- outfits
- clothing items
- user-outfit relationships
- likes/preferences
- item metadata

The objective is to determine how IQON3000 can support the collaborative/preference component of our Hybrid Filtering system.

Do not merge IQON3000 users with real StyleSense users.

External dataset users are training/evaluation entities only.

Never expose external user identities in the StyleSense application.

------------------------------------------
D. SUPABASE USER WARDROBE
------------------------------------------

This is the actual application dataset.

It contains the clothing items belonging to real StyleSense users.

The existing schema and data must be preserved.

The recommendation engine must ultimately operate on:

    User's Supabase wardrobe
    +
    User preferences
    +
    Context
    +
    learned compatibility/personalization signals

Do NOT replace this with DeepFashion, Polyvore, or IQON3000.

==================================================
TARGET PIPELINE
==================================================

The intended architecture is:

USER TAKES / UPLOADS PHOTO
        ↓
IMAGE PREPROCESSING
        ↓
RESNET-50 CNN
        ↓
CATEGORY + VISUAL/SEMANTIC FEATURES
        ↓
K-MEANS
        ↓
COLOR / VISUAL REPRESENTATION
        ↓
SAVE CLOTHING ITEM
        ↓
SUPABASE USER WARDROBE
        ↓
HYBRID RECOMMENDATION ENGINE
        ↓
GENERATE CANDIDATE OUTFITS
        ↓
HARD CONSTRAINT FILTERING
        ↓
CONTENT-BASED SCORE
        ↓
USER PREFERENCE / COLLABORATIVE SCORE
        ↓
HYBRID SCORE
        ↓
RANK OUTFITS
        ↓
TOP-3 RECOMMENDATIONS
        ↓
USER FEEDBACK
        ↓
UPDATE USER PREFERENCE PROFILE

==================================================
HYBRID RECOMMENDATION
==================================================

The current intended hybrid formula is:

Score = (0.55 * S_cb) + (0.45 * S_cf)

Where:

S_cb = Content-Based score

S_cf = Collaborative / user-preference score

The current Content-Based factors include:

- color harmony
- occasion suitability
- weather compatibility

The current preference/collaborative component includes:

- user style weights
- user color weights
- user preference history
- disliked items / negative feedback

The recommendation engine must generate candidate outfits from the user's own wardrobe.

Example:

Top × Bottom × Shoes × Optional Outerwear

Then:

1. remove unavailable/dirty items
2. apply occasion constraints
3. apply weather constraints
4. apply wardrobe ownership constraints
5. calculate content compatibility
6. calculate user preference score
7. calculate hybrid score
8. rank candidates
9. return Top-3

==================================================
MATHEMATICAL REQUIREMENT
==================================================

Do not leave the algorithms as vague descriptions.

Document the actual mathematical operations implemented by the code.

For CNN:
- preprocessing
- model inference
- logits
- Softmax probabilities
- predicted class
- confidence
- training loss if training/fine-tuning is implemented

For K-Means:
- feature representation
- initialization
- Euclidean distance or actual distance metric used
- cluster assignment
- centroid update
- convergence condition

For Hybrid Filtering:
- exact definition of S_cb
- exact definition of S_cf
- normalization of component scores
- hybrid formula
- ranking procedure
- hard constraints versus soft scoring
- treatment of disliked items
- cold-start behavior
- The production recommendation output is limited to the Top 3 highest-ranked outfit combinations.

IMPORTANT:
Do not invent formulas merely because they sound appropriate.
Inspect the existing implementation first.
If the current implementation does not have a mathematically explicit formulation, propose one separately and clearly label it as a proposed implementation change.

==================================================
EXPERIMENTAL / BENCHMARKING PLAN
==================================================

We want to benchmark the algorithms scientifically.

CNN:
Compare the current ResNet-50 implementation against at least one lightweight alternative if feasible.

Potential metrics:
- Accuracy
- Macro Precision
- Macro Recall
- Macro F1
- Confusion Matrix
- inference time
- model size

K-Means:
Evaluate clustering using appropriate unsupervised metrics such as:
- Silhouette Score
- Davies-Bouldin Index

If ground-truth color/attribute annotations are available, investigate whether external validation against those annotations is appropriate.

Hybrid Recommendation:
Compare:
1. Content-Based only
2. Collaborative/Preference only where sufficient data exists
3. Hybrid Filtering

Potential recommendation metrics:
- Precision@3
- Recall@3
- NDCG@3
- Hit Rate@3

Also preserve our planned human/user evaluation.

==================================================
CURRENT WARDROBE IMAGE PIPELINE
==================================================

We are considering background removal using remove.bg.

Treat this as a preprocessing enhancement, NOT as a new recommendation algorithm.

Potential flow:

User Image
    ↓
Background Removal
    ↓
Clean Garment Image
    ↓
CNN / K-Means
    ↓
Wardrobe Item

Investigate whether background removal should happen:
- before CNN inference
- only for storage/display
- or both

Do not assume it improves classification.
Benchmark if possible.

Keep the original uploaded image and processed image logically separate if the current architecture allows it.

Do not expose remove.bg API keys to the mobile client.
API credentials must remain server-side.

==================================================
VIRTUAL TRY-ON
==================================================

Virtual Try-On is a FUTURE / OPTIONAL phase.

Do NOT implement it immediately.

The product concept is:

Recommended Outfit
       ↓
"Try It On"
       ↓
User provides appropriate body/person image
       ↓
Virtual Try-On service
       ↓
Rendered visualization

The Walmart "Be Your Own Model" experience is a PRODUCT REFERENCE only.

Do NOT assume Walmart/Zeekit provides a public API for our project.

Before implementing VTO:

1. identify an actually accessible API/model
2. verify its API/license/terms
3. determine expected input image format
4. determine whether it requires front-facing full-body images
5. determine whether multiple angles are actually required
6. determine cost/usage limits
7. determine latency
8. determine privacy/data retention implications
9. determine whether it can accept our wardrobe garment images
10. determine whether it can process multiple garments in one outfit

Only after these are answered should implementation begin.

VTO must be treated as a visualization layer AFTER recommendation.

It must NOT replace:
- CNN
- K-Means
- Hybrid Filtering

Do not claim that VTO solves clothing compatibility or recommendation accuracy.

It solves a different problem:
"How does this recommended outfit visually appear on the user?"

==================================================
USER BODY INFORMATION
==================================================

Do not make height, weight, or body measurements mandatory merely because VTO is being considered.

Investigate what the chosen VTO provider actually requires.

Separate:

Recommendation personalization:
- style preference
- color preference
- occasion
- weather
- wardrobe
- interaction history

from

Virtual Try-On visualization:
- body/person image
- pose
- garment image
- potentially body proportions

Do not collect sensitive body information unless it is actually required by the chosen implementation and justified by the project.

==================================================
FRONTEND VS BACKEND PRIORITY
==================================================

The frontend team may independently improve the visual design.

Frontend priorities:
- aesthetic wardrobe browsing
- modern product-card presentation
- category chips
- outfit cards
- image-focused layouts
- animations/transitions
- polished onboarding
- recommendation presentation

Do not block backend/ML work on these visual changes.

Backend/ML priorities:
1. inspect existing implementation
2. stabilize image upload pipeline
3. establish dataset ingestion structure
4. establish DeepFashion CNN training/evaluation pipeline
5. establish K-Means feature pipeline
6. implement/verify Hybrid Filtering
7. establish recommendation evaluation
8. implement background removal if useful
9. investigate VTO only after the core recommendation pipeline is functioning

==================================================
IMPORTANT ENGINEERING RULES
==================================================

Before changing code:

1. Inspect the repository.
2. Identify existing ML service.
3. Identify current ResNet-50 implementation.
4. Identify current Supabase schema.
5. Identify wardrobe item tables.
6. Identify recommendation tables.
7. Identify preference/feedback tables.
8. Identify API endpoints.
9. Identify existing image storage.
10. Identify existing tests.

Do not duplicate existing functionality.

Do not create a second wardrobe system.

Do not create a second recommendation engine without first understanding the existing one.

Do not silently change database schemas.

Do not download enormous datasets into Git.

Use dataset manifests/configuration paths instead.

Keep datasets outside the application repository where appropriate.

Create reproducible scripts for:
- dataset preparation
- category mapping
- feature extraction
- training
- evaluation
- benchmarking

==================================================
FIRST TASK
==================================================

DO NOT IMPLEMENT EVERYTHING YET.

First perform a repository audit.

Return a report containing:

1. Current architecture
2. Current backend architecture
3. Current ML architecture
4. Current Supabase schema relevant to wardrobe/recommendations
5. Current image-processing pipeline
6. Current ResNet-50 implementation
7. Current K-Means implementation, if any
8. Current Hybrid Filtering implementation
9. Current recommendation scoring formula
10. Current user preference/feedback implementation
11. Current gaps relative to the dataset strategy above
12. Files/modules that would need modification
13. New files/modules that would need to be created
14. Dataset storage strategy
15. Recommended implementation order
16. Risks and possible breaking changes

Then STOP.

Do not begin implementation until the audit is complete.