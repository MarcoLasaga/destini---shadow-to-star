import { getSupabaseClient } from './supabase'

export interface UploadResult {
  url: string
  publicId: string
}

export const uploadService = {
  async uploadBuffer(buffer: Buffer, filename: string, mimetype: string, token?: string): Promise<UploadResult> {
    const supabase = getSupabaseClient(token)

    // Attempt to ensure bucket exists (only works if admin key is configured, safe warning if not)
    try {
      const { data: buckets } = await supabase.storage.listBuckets()
      if (!buckets?.find(b => b.id === 'wardrobe-images')) {
        await supabase.storage.createBucket('wardrobe-images', {
          public: true,
          fileSizeLimit: 5242880, // 5MB
        })
      }
    } catch (e) {
      console.warn('Could not verify/create Supabase Storage bucket automatically (this is normal if using anon key):', e)
    }

    const safeName = `${Date.now()}-${filename.replace(/[^a-z0-9.]/gi, '_')}`
    const path = `uploads/${safeName}`

    const { error } = await supabase.storage
      .from('wardrobe-images')
      .upload(path, buffer, {
        contentType: mimetype,
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
    const supabase = getSupabaseClient(token)
    const { error } = await supabase.storage
      .from('wardrobe-images')
      .remove([publicId])

    if (error) {
      console.error('Error deleting file from Supabase Storage:', error)
    }
  },
}
