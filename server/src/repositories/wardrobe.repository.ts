import prisma from '../config/prisma'
import type { CreateItemInput, UpdateItemInput, FilterInput } from '../validators/wardrobe.validator'

export const wardrobeRepository = {
  async findAll(userId: string, filters: FilterInput) {
    const { category, style, occasion, season, laundryStatus, isFavorite, search, sortBy, sortDir, page, limit } = filters

    const where: any = { userId }

    if (category) where.category = category
    if (style) where.style = style
    if (occasion) where.occasion = occasion
    if (season) where.season = season
    if (laundryStatus) where.laundryStatus = laundryStatus
    if (isFavorite !== undefined) where.isFavorite = isFavorite

    if (search) {
      where.OR = [
        { clothingName: { contains: search } },
        { brand: { contains: search } },
        { color: { contains: search } },
        { notes: { contains: search } },
      ]
    }

    const [items, total] = await Promise.all([
      prisma.wardrobeItem.findMany({
        where,
        orderBy: { [sortBy ?? 'createdAt']: sortDir ?? 'desc' },
        skip: ((page ?? 1) - 1) * (limit ?? 20),
        take: limit ?? 20,
      }),
      prisma.wardrobeItem.count({ where }),
    ])

    return { items, total, page: page ?? 1, limit: limit ?? 20, totalPages: Math.ceil(total / (limit ?? 20)) }
  },

  async findById(id: string, userId: string) {
    return prisma.wardrobeItem.findFirst({ where: { id, userId } })
  },

  async create(userId: string, data: CreateItemInput, imageUrl?: string) {
    return prisma.wardrobeItem.create({
      data: {
        userId,
        imageUrl,
        category: data.category as any,
        subcategory: data.subcategory,
        clothingName: data.clothingName,
        color: data.color,
        material: data.material,
        brand: data.brand,
        style: data.style as any,
        occasion: data.occasion as any,
        season: data.season as any,
        size: data.size,
        estimatedPrice: data.estimatedPrice,
        notes: data.notes,
      },
    })
  },

  async update(id: string, userId: string, data: UpdateItemInput, imageUrl?: string) {
    const existing = await wardrobeRepository.findById(id, userId)
    if (!existing) return null

    return prisma.wardrobeItem.update({
      where: { id },
      data: {
        ...(imageUrl && { imageUrl }),
        ...(data.category && { category: data.category as any }),
        ...(data.subcategory !== undefined && { subcategory: data.subcategory }),
        ...(data.clothingName && { clothingName: data.clothingName }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.material !== undefined && { material: data.material }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.style !== undefined && { style: data.style as any }),
        ...(data.occasion !== undefined && { occasion: data.occasion as any }),
        ...(data.season !== undefined && { season: data.season as any }),
        ...(data.size !== undefined && { size: data.size }),
        ...(data.estimatedPrice !== undefined && { estimatedPrice: data.estimatedPrice }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    })
  },

  async delete(id: string, userId: string) {
    const existing = await wardrobeRepository.findById(id, userId)
    if (!existing) return null
    await prisma.wardrobeItem.delete({ where: { id } })
    return existing
  },

  async toggleFavorite(id: string, userId: string) {
    const item = await wardrobeRepository.findById(id, userId)
    if (!item) return null
    return prisma.wardrobeItem.update({
      where: { id },
      data: { isFavorite: !item.isFavorite },
    })
  },

  async markClean(id: string, userId: string) {
    const item = await wardrobeRepository.findById(id, userId)
    if (!item) return null
    return prisma.wardrobeItem.update({
      where: { id },
      data: {
        laundryStatus: 'CLEAN',
        washCount: { increment: 1 },
        lastWashedAt: new Date(),
      },
    })
  },

  async incrementWear(id: string, userId: string) {
    const item = await wardrobeRepository.findById(id, userId)
    if (!item) return null

    const newWearCount = item.wearCount + 1
    let laundryStatus = item.laundryStatus
    if (newWearCount % 5 === 0) laundryStatus = 'NEEDS_WASHING'
    else if (newWearCount % 3 === 0) laundryStatus = 'NEEDS_WASHING_SOON'

    return prisma.wardrobeItem.update({
      where: { id },
      data: { wearCount: { increment: 1 }, lastWornAt: new Date(), laundryStatus },
    })
  },

  async countByUser(userId: string) {
    return prisma.wardrobeItem.count({ where: { userId } })
  },
}
