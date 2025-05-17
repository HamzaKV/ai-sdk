export const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length) {
        throw new Error('Vectors must be of the same length')
    }

    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0)
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0))
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0))

    if (magnitudeA === 0 || magnitudeB === 0) {
        throw new Error('Vector magnitude cannot be zero')
    }

    return dotProduct / (magnitudeA * magnitudeB)
};
