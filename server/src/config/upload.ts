import sharp from 'sharp'
import { getSupabaseClient } from './supabase'

export interface UploadResult {
  url: string
  publicId: string
}

let bucketChecked = false

export const uploadService = {
  async uploadBuffer(buffer: Buffer, filename: string, mimetype: string, userId: string, token?: string): Promise<UploadResult> {
    const supabase = await getSupabaseClient(token)

    // Attempt to ensure bucket exists once per server boot (only works if admin key is configured)
    if (!bucketChecked) {
      try {
        const { data: buckets } = await supabase.storage.listBuckets()
        if (!buckets?.find(b => b.id === 'wardrobe-images')) {
          await supabase.storage.createBucket('wardrobe-images', {
            public: true,
            fileSizeLimit: 5242880, // 5MB
          })
        }
        bucketChecked = true
      } catch (e) {
        console.warn('Could not verify/create Supabase Storage bucket automatically (this is normal if using anon key):', e)
        bucketChecked = true
      }
    }

    // Compress & convert buffer to fast-loading WebP format (sub-80ms CDN load times)
    const webpBuffer = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize(640, 640, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, alphaQuality: 90, effort: 4 })
      .toBuffer()

    const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_')
    const safeName = `${Date.now()}-${baseName || 'image'}.webp`
    // First path segment is the owner id; Storage RLS policies rely on it.
    const path = `${userId}/${safeName}`

    const { error } = await supabase.storage
      .from('wardrobe-images')
      .upload(path, webpBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      })

    if (error) {
      console.error('Error uploading file to Supabase Storage:', error)
      throw error
    }

    const { data: urlData } = supabase.storage
      .from('wardrobe-images')
      .getPublicUrl(path)

    return {
      url: urlData.publicUrl,
      publicId: path,
    }
  },

  async deleteFile(publicId: string, token?: string): Promise<void> {
    const supabase = await getSupabaseClient(token)
    const { error } = await supabase.storage
      .from('wardrobe-images')
      .remove([publicId])

    if (error) {
      console.error('Error deleting file from Supabase Storage:', error)
    }
  },
}
