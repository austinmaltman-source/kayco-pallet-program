import React from 'react'
import { PlacedProduct } from '../../../types'
import { BasicBoxProduct } from './BasicBoxProduct'
import { PhotoProductModel } from './PhotoProductModel'

interface TexturedBoxProductProps {
  product: PlacedProduct
  position: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  onClick?: () => void
  onPointerOver?: () => void
  onPointerOut?: () => void
}

// A product with a photo renders as a model built from that photo (round
// lathe or photo-faced box, see PhotoProductModel). The plain colored box
// shows while the photo loads, and stays if the photo cannot be read.
export const TexturedBoxProduct: React.FC<TexturedBoxProductProps> = (props) => {
  const fallback = <BasicBoxProduct {...props} />
  if (!props.product.imageUrl) return fallback
  return <PhotoProductModel {...props} fallback={fallback} />
}
