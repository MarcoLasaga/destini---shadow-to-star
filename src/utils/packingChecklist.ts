import { PackingItem } from '../types';

type ChecklistSeed = { label: string; category: PackingItem['category'] };

function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
}

export function buildPackingChecklist(startISO: string, endISO: string, avgTempF?: number): ChecklistSeed[] {
  const days = daysBetween(startISO, endISO);
  const isCold = avgTempF !== undefined && avgTempF < 60;
  const isHot = avgTempF !== undefined && avgTempF > 82;

  const items: ChecklistSeed[] = [];

  const topsCount = Math.min(Math.ceil(days * 0.8), 10);
  const bottomsCount = Math.min(Math.ceil(days / 2), 6);

  for (let i = 1; i <= topsCount; i++) items.push({ label: `${i} Top${i > 1 ? 's' : ''}`, category: 'Clothing' });
  items.push({ label: `${bottomsCount} Bottom${bottomsCount > 1 ? 's' : ''}`, category: 'Clothing' });
  items.push({ label: `${days} Pairs of Underwear`, category: 'Clothing' });
  items.push({ label: `${days} Pairs of Socks`, category: 'Clothing' });
  items.push({ label: `${Math.ceil(days / 3)} Pajamas`, category: 'Clothing' });

  if (isCold) {
    items.push({ label: 'Warm Jacket', category: 'Clothing' });
    items.push({ label: 'Scarf & Gloves', category: 'Accessories' });
  }
  if (isHot) {
    items.push({ label: 'Sun Hat', category: 'Accessories' });
    items.push({ label: 'Light Breathable Outfit', category: 'Clothing' });
  }

  items.push({ label: '1 Pair of Shoes', category: 'Footwear' });
  items.push({ label: 'Optional Dressy Outfit', category: 'Clothing' });

  items.push({ label: 'Sunglasses', category: 'Accessories' });
  items.push({ label: 'Umbrella', category: 'Accessories' });

  items.push({ label: 'Toiletries Bag', category: 'Toiletries' });
  items.push({ label: 'Toothbrush & Toothpaste', category: 'Toiletries' });
  items.push({ label: 'Skincare Essentials', category: 'Toiletries' });

  items.push({ label: 'Phone Charger', category: 'Essentials' });
  items.push({ label: 'Passport/ID', category: 'Essentials' });
  items.push({ label: 'Medications', category: 'Essentials' });

  return items;
}