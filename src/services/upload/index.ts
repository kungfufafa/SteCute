export interface UploadConstraints {
  maxFileSize: number // bytes
  maxFiles: number
  acceptedTypes: string[]
}

export const DEFAULT_UPLOAD_CONSTRAINTS: UploadConstraints = {
  maxFileSize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 6,
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp'],
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateFiles(files: File[], slotCount: number): ValidationResult {
  const errors: string[] = []
  const constraints = DEFAULT_UPLOAD_CONSTRAINTS

  if (files.length === 0) {
    return { valid: false, errors: ['Belum ada file yang dipilih.'] }
  }

  if (files.length > constraints.maxFiles) {
    errors.push(`Maksimal ${constraints.maxFiles} file per sesi. Kamu memilih ${files.length}.`)
  }

  if (files.length !== slotCount) {
    errors.push(`Layout ini membutuhkan tepat ${slotCount} foto. Kamu memilih ${files.length}.`)
  }

  for (const file of files) {
    if (!constraints.acceptedTypes.includes(file.type)) {
      errors.push(`"${file.name}" bukan format yang didukung. Gunakan JPG, PNG, atau WebP.`)
    }
    if (file.size > constraints.maxFileSize) {
      errors.push(`"${file.name}" melebihi batas ukuran 10 MB.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export function validateFile(file: File): ValidationResult {
  return validateFiles([file], 1)
}

export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file)

  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to decode ${file.name}`))
    }

    image.src = url
  })
}

export function openImagePicker(multiple: boolean = true): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.multiple = multiple
    input.onchange = () => {
      resolve(input.files)
    }
    input.click()
  })
}

export function loadImageAsBitmap(
  file: File,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      createImageBitmap(img)
        .then((bitmap) => {
          URL.revokeObjectURL(url)
          resolve({ bitmap, width: img.naturalWidth, height: img.naturalHeight })
        })
        .catch((err) => {
          URL.revokeObjectURL(url)
          reject(err)
        })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load image: ${file.name}`))
    }
    img.src = url
  })
}
