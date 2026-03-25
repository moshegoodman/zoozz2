/**
 * PDF Manager Utility
 * Handles PDF retrieval from database with fallback to generation
 */

export async function getPDFWithFallback(orderId, pdfType, generateFn, config = {}) {
  try {
    // Try to retrieve from database first
    const { managePDF } = await import('@/functions/managePDF');
    const dbResponse = await managePDF({ 
      action: 'retrieve', 
      order_id: orderId, 
      pdf_type: pdfType 
    });

    if (dbResponse.success && dbResponse.pdfBase64) {
      console.log(`✅ ${pdfType} retrieved from database`);
      return dbResponse.pdfBase64;
    }
  } catch (e) {
    console.log(`⚠️ DB retrieval failed for ${pdfType}, will generate fresh:`, e.message);
  }

  // Fallback: generate fresh
  console.log(`📄 Generating fresh ${pdfType}`);
  const response = await generateFn(config);
  
  if (response.data?.success && response.data?.pdfBase64) {
    return response.data.pdfBase64;
  }

  throw new Error(response.data?.error || `Failed to generate ${pdfType}`);
}

export function downloadPDF(pdfBase64, filename) {
  const cleanBase64 = pdfBase64.replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pdfBlob = new Blob([bytes], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}