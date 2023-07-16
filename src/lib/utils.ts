
export const FLOAT_SIZE = new Float32Array(0).BYTES_PER_ELEMENT;
export const INDEX_SIZE = new Uint16Array(0).BYTES_PER_ELEMENT;

export function createWebgpuVertexBuffer(geometry: THREE.BufferGeometry, attributeLocations: Record<string, number>) {
  if (!geometry.index) throw new Error('threePlaneGeometry: no index')

  const attributes = Object.keys(attributeLocations).sort((a, b) => attributeLocations[a] - attributeLocations[b]);

  let currentOffset = 0
  const attrBufferLayout = attributes.map((attr, i) => {
    const itemSize = geometry.attributes[attr].itemSize;
    const attrLayout = {
      shaderLocation: attributeLocations[attr],
      offset: currentOffset,
      format: `float32x${itemSize}`,
    }
    currentOffset += FLOAT_SIZE * itemSize;
    return attrLayout
  }) as GPUVertexBufferLayout['attributes']
  const attrBufferStride = attributes.map(attr => geometry.attributes[attr].itemSize).reduce((cSum, c) => cSum + c * FLOAT_SIZE, 0)

  const vertexCount = geometry.attributes[attributes[0]].count;
  const vertexData = new Float32Array(Array(vertexCount).fill(undefined).flatMap((_, i) => {
    return attributes.flatMap(attr => {
      const threeAttr = geometry.attributes[attr];
      return [...threeAttr.array.slice(i * threeAttr.itemSize, (i + 1) * threeAttr.itemSize)]
    });

  }));

  return {
    attrBufferLayout,
    attrBufferStride,
    vertexData,
    indices: geometry.index.array,
  }
}

export function degToRad(deg: number) {
  return deg * Math.PI / 180;
}