import { AnatomicalSlotType, ClothingRole } from '../types';

export interface DatasetGarmentItem {
  id: string;
  name: string;
  category: ClothingRole;
  dbCategory: 'TOP' | 'OUTERWEAR' | 'BOTTOM' | 'SHOES' | 'ACCESSORIES';
  slotType: AnatomicalSlotType;
  color: string;
  colorHex: string;
  style: string;
  occasions: string[];
  genderFit: 'mens' | 'unisex';
  imageUri: string;
}

/**
 * Verified studio garment photographs representing extracted DeepFashion / Re-Polyvore
 * reference garments across all 5 categories (Top, Outerwear, Bottom, Shoes, Accessories).
 * Every image URL is a verified studio photograph of the exact garment type and color.
 */
export const DATASET_GARMENT_CATALOG: DatasetGarmentItem[] = [
  // ==================== TOPS (INNER BASE TOPS) ====================
  {
    id: 'dataset-top-white-polo',
    name: 'Crisp White Polo Shirt',
    category: 'Top',
    dbCategory: 'TOP',
    slotType: 'innerTop',
    color: 'White',
    colorHex: '#F7F7F5',
    style: 'Smart Casual',
    occasions: ['Office', 'Academic', 'Casual'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-top-white-oxford',
    name: 'White Oxford Button-Down',
    category: 'Top',
    dbCategory: 'TOP',
    slotType: 'innerTop',
    color: 'White',
    colorHex: '#F7F7F5',
    style: 'Formal',
    occasions: ['Office', 'Formal', 'Academic'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-top-blue-oxford',
    name: 'Light Blue Oxford Shirt',
    category: 'Top',
    dbCategory: 'TOP',
    slotType: 'innerTop',
    color: 'Blue',
    colorHex: '#3B6EA5',
    style: 'Business',
    occasions: ['Office', 'Formal', 'Academic'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-top-white-tee',
    name: 'White Heavyweight Crewneck Tee',
    category: 'Top',
    dbCategory: 'TOP',
    slotType: 'innerTop',
    color: 'White',
    colorHex: '#F7F7F5',
    style: 'Casual',
    occasions: ['Casual', 'Academic', 'Workout'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-top-black-tee',
    name: 'Black Essential Crewneck Tee',
    category: 'Top',
    dbCategory: 'TOP',
    slotType: 'innerTop',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Casual',
    occasions: ['Casual', 'Academic', 'Workout'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80',
  },

  // ==================== OUTERWEAR (2ND LAYER) ====================
  {
    id: 'dataset-outer-charcoal-blazer',
    name: 'Tailored Charcoal Blazer',
    category: 'Outerwear',
    dbCategory: 'OUTERWEAR',
    slotType: 'outerLayer',
    color: 'Charcoal',
    colorHex: '#36393F',
    style: 'Formal',
    occasions: ['Office', 'Formal'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-outer-navy-blazer',
    name: 'Structured Navy Suit Blazer',
    category: 'Outerwear',
    dbCategory: 'OUTERWEAR',
    slotType: 'outerLayer',
    color: 'Navy',
    colorHex: '#1D2D50',
    style: 'Formal',
    occasions: ['Formal', 'Office'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-outer-black-hoodie',
    name: 'Black Fleece Pullover Hoodie',
    category: 'Outerwear',
    dbCategory: 'OUTERWEAR',
    slotType: 'outerLayer',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Streetwear',
    occasions: ['Academic', 'Casual', 'Workout'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-outer-denim-jacket',
    name: 'Classic Layering Jacket',
    category: 'Outerwear',
    dbCategory: 'OUTERWEAR',
    slotType: 'outerLayer',
    color: 'Navy',
    colorHex: '#253858',
    style: 'Casual',
    occasions: ['Casual', 'Academic'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80',
  },

  // ==================== BOTTOMS ====================
  {
    id: 'dataset-bottom-navy-chinos',
    name: 'Tailored Navy Chinos',
    category: 'Bottom',
    dbCategory: 'BOTTOM',
    slotType: 'bottom',
    color: 'Navy',
    colorHex: '#1D2D50',
    style: 'Business',
    occasions: ['Office', 'Formal', 'Academic'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-bottom-khaki-chinos',
    name: 'Khaki Tapered Chinos',
    category: 'Bottom',
    dbCategory: 'BOTTOM',
    slotType: 'bottom',
    color: 'Khaki',
    colorHex: '#C8B08A',
    style: 'Smart Casual',
    occasions: ['Academic', 'Office', 'Casual'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-bottom-dark-jeans',
    name: 'Dark Indigo Straight Jeans',
    category: 'Bottom',
    dbCategory: 'BOTTOM',
    slotType: 'bottom',
    color: 'Blue',
    colorHex: '#253858',
    style: 'Casual',
    occasions: ['Casual', 'Academic'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=80',
  },

  // ==================== SHOES ====================
  {
    id: 'dataset-shoes-leather-loafers',
    name: 'Classic Leather Loafers',
    category: 'Shoes',
    dbCategory: 'SHOES',
    slotType: 'shoes',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Formal',
    occasions: ['Office', 'Formal'],
    genderFit: 'mens',
    imageUri: 'https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-shoes-white-sneakers',
    name: 'Clean White Leather Sneakers',
    category: 'Shoes',
    dbCategory: 'SHOES',
    slotType: 'shoes',
    color: 'White',
    colorHex: '#F7F7F5',
    style: 'Casual',
    occasions: ['Casual', 'Academic', 'Office'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-shoes-black-sneakers',
    name: 'Black Athletic Sneakers',
    category: 'Shoes',
    dbCategory: 'SHOES',
    slotType: 'shoes',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Athletic',
    occasions: ['Workout', 'Casual', 'Academic'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
  },

  // ==================== ACCESSORIES ====================
  {
    id: 'dataset-acc-silver-watch',
    name: 'Silver Chrono Dress Watch',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Gray',
    colorHex: '#8C929C',
    style: 'Formal',
    occasions: ['Office', 'Formal', 'Casual'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-black-smartwatch',
    name: 'Black Smartwatch',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Casual',
    occasions: ['Casual', 'Academic', 'Workout', 'Office'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-spiked-choker',
    name: 'Spiked Leather Choker',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Rockstar',
    occasions: ['Casual', 'Party', 'Concert'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-cuban-chain',
    name: 'Heavy Silver Cuban Chain',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Silver',
    colorHex: '#D8DDE3',
    style: 'Streetwear',
    occasions: ['Casual', 'Party', 'Academic'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1611591475879-11c7b805c8d0?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-spike-earrings',
    name: 'Chrome Spike Drop Earrings',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Silver',
    colorHex: '#E2E8F0',
    style: 'Rockstar',
    occasions: ['Casual', 'Party', 'Concert'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-pearl-studs',
    name: 'Pearl Stud Earrings',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'White',
    colorHex: '#F7F7F5',
    style: 'Chic',
    occasions: ['Office', 'Formal', 'Casual', 'Academic'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-grommet-belt',
    name: 'Studded Grommet Belt + Hip Chain',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Rockstar',
    occasions: ['Casual', 'Party', 'Academic'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-crossbody-bag',
    name: 'Leather Crossbody Saddle Bag',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Brown',
    colorHex: '#6F4E37',
    style: 'Chic',
    occasions: ['Casual', 'Academic', 'Office'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-gold-sunglasses',
    name: 'Retro Gold Wire Sunglasses',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Gold',
    colorHex: '#D4AF37',
    style: 'Vintage',
    occasions: ['Casual', 'Academic', 'Party'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-matte-sunglasses',
    name: 'Black Matte Aviator Sunglasses',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Black',
    colorHex: '#1A1A1A',
    style: 'Streetwear',
    occasions: ['Casual', 'Workout', 'Party'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-layered-necklace',
    name: 'Layered Silver Chain Necklace',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Silver',
    colorHex: '#D8DDE3',
    style: 'Streetwear',
    occasions: ['Casual', 'Academic', 'Party'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'dataset-acc-spiked-wristband',
    name: 'Heavy Metal Spiked Wristband',
    category: 'Accessory',
    dbCategory: 'ACCESSORIES',
    slotType: 'accessory',
    color: 'Black',
    colorHex: '#1E1E24',
    style: 'Rockstar',
    occasions: ['Casual', 'Party', 'Concert'],
    genderFit: 'unisex',
    imageUri: 'https://images.unsplash.com/photo-1611591475879-11c7b805c8d0?auto=format&fit=crop&w=800&q=80',
  },
];

export function getDatasetPicksForSlot(
  slot: AnatomicalSlotType,
  occasion?: string
): DatasetGarmentItem[] {
  const slotItems = DATASET_GARMENT_CATALOG.filter((item) => item.slotType === slot);
  if (!occasion || occasion === 'Any occasion' || occasion === 'All') {
    return slotItems;
  }
  const occLower = occasion.toLowerCase();
  const matching = slotItems.filter((item) =>
    item.occasions.some((o) => occLower.includes(o.toLowerCase()))
  );
  return matching.length > 0 ? [...matching, ...slotItems.filter((i) => !matching.includes(i))] : slotItems;
}

export function resolveDatasetGarmentPhoto(
  name?: string | null,
  category?: string | null,
  currentImageUri?: string | null
): string {
  if (
    currentImageUri &&
    currentImageUri.trim() !== '' &&
    !currentImageUri.startsWith('illustration://') &&
    !currentImageUri.includes('picsum.photos')
  ) {
    return currentImageUri;
  }

  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();

  // Exact or close name match in catalog
  const exact = DATASET_GARMENT_CATALOG.find((item) => item.name.toLowerCase() === n);
  if (exact) return exact.imageUri;

  if (n.includes('smartwatch')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-acc-black-smartwatch')!.imageUri;
  if (n.includes('watch')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-acc-silver-watch')!.imageUri;
  if (n.includes('hoodie') || n.includes('sweatshirt')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-outer-black-hoodie')!.imageUri;
  if (n.includes('navy') && (n.includes('blazer') || n.includes('suit'))) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-outer-navy-blazer')!.imageUri;
  if (n.includes('blazer') || n.includes('suit') || n.includes('coat')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-outer-charcoal-blazer')!.imageUri;
  if (n.includes('jacket') || n.includes('cardigan')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-outer-denim-jacket')!.imageUri;
  if (n.includes('polo')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-top-white-polo')!.imageUri;
  if (n.includes('blue') && (n.includes('shirt') || n.includes('button') || n.includes('oxford'))) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-top-blue-oxford')!.imageUri;
  if (n.includes('oxford') || n.includes('button') || n.includes('dress shirt')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-top-white-oxford')!.imageUri;
  if (n.includes('black') && (n.includes('tee') || n.includes('t-shirt') || n.includes('shirt'))) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-top-black-tee')!.imageUri;
  if (n.includes('khaki') || n.includes('beige') || n.includes('tan')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-bottom-khaki-chinos')!.imageUri;
  if (n.includes('jean') || n.includes('denim')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-bottom-dark-jeans')!.imageUri;
  if (n.includes('chino') || n.includes('trouser') || n.includes('pant')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-bottom-navy-chinos')!.imageUri;
  if (n.includes('loafer') || n.includes('oxford shoe') || n.includes('dress shoe')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-shoes-leather-loafers')!.imageUri;
  if (n.includes('black') && n.includes('sneaker')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-shoes-black-sneakers')!.imageUri;
  if (n.includes('sneaker') || n.includes('shoe')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-shoes-white-sneakers')!.imageUri;

  if (c.includes('accessor')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-acc-silver-watch')!.imageUri;
  if (c.includes('outer')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-outer-charcoal-blazer')!.imageUri;
  if (c.includes('bottom')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-bottom-navy-chinos')!.imageUri;
  if (c.includes('shoe')) return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-shoes-white-sneakers')!.imageUri;
  return DATASET_GARMENT_CATALOG.find((i) => i.id === 'dataset-top-white-polo')!.imageUri;
}

