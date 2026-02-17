import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const results = {
        drive: { success: false, step: '', message: '', error: null },
        pdfUpload: { success: false, step: '', message: '', error: null },
        sheets: { success: false, step: '', message: '', error: null }
    };

    try {
        // Step 1: Verify admin access
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ 
                success: false, 
                error: 'Admin access required',
                results 
            }, { status: 403 });
        }

        // Step 2: Get access tokens
        let driveToken, sheetsToken;
        
        try {
            driveToken = await base44.asServiceRole.connectors.getAccessToken("googledrive");
            results.drive.step = 'Token retrieved';
        } catch (error) {
            results.drive.step = 'Token retrieval failed';
            results.drive.error = error.message;
            results.drive.message = 'Failed to get Google Drive access token';
        }

        try {
            sheetsToken = await base44.asServiceRole.connectors.getAccessToken("googlesheets");
            results.sheets.step = 'Token retrieved';
        } catch (error) {
            results.sheets.step = 'Token retrieval failed';
            results.sheets.error = error.message;
            results.sheets.message = 'Failed to get Google Sheets access token';
        }

        // Test Google Drive
        if (driveToken) {
            try {
                results.drive.step = 'Testing Drive upload';
                
                const fileName = `Test_${new Date().toISOString()}.txt`;
                const fileContent = 'Test file from Zoozz system';
                
                // Use resumable upload (works with drive.file scope)
                const metadata = {
                    name: fileName,
                    mimeType: 'text/plain'
                };

                // Step 1: Initiate resumable upload
                const initiateResponse = await fetch(
                    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${driveToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(metadata)
                    }
                );

                if (!initiateResponse.ok) {
                    const errorText = await initiateResponse.text();
                    throw new Error(`Upload initiation failed (${initiateResponse.status}): ${errorText}`);
                }

                const uploadUrl = initiateResponse.headers.get('Location');
                if (!uploadUrl) {
                    throw new Error('No upload URL received from Google Drive');
                }

                results.drive.step = 'Upload initiated, uploading content';

                // Step 2: Upload content
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: fileContent
                });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    throw new Error(`Content upload failed (${uploadResponse.status}): ${errorText}`);
                }

                const uploadResult = await uploadResponse.json();
                
                results.drive.success = true;
                results.drive.step = 'Complete';
                results.drive.message = `File uploaded successfully: ${fileName}`;
                results.drive.fileId = uploadResult.id;
                results.drive.fileName = uploadResult.name;

            } catch (error) {
                results.drive.success = false;
                results.drive.message = 'Drive test failed';
                results.drive.error = error.message;
            }
        }

        // Test PDF upload to invoices folder
        if (driveToken) {
            try {
                results.pdfUpload.step = 'Checking folder ID';
                
                const invoicesFolderId = Deno.env.get("GOOGLE_DRIVE_INVOICES_FOLDER_ID");
                
                if (!invoicesFolderId) {
                    throw new Error('GOOGLE_DRIVE_INVOICES_FOLDER_ID environment variable not set');
                }

                results.pdfUpload.step = 'Creating test PDF';
                results.pdfUpload.folderId = invoicesFolderId;
                
                // Create a minimal valid PDF
                const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Test PDF Invoice) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000317 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
409
%%EOF`;

                const fileName = `test-invoice-${Date.now()}.pdf`;
                const metadata = {
                    name: fileName,
                    mimeType: 'application/pdf',
                    parents: [invoicesFolderId]
                };

                results.pdfUpload.step = 'Initiating PDF upload';

                // Step 1: Initiate resumable upload with folder parent
                const initiateResponse = await fetch(
                    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${driveToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(metadata)
                    }
                );

                if (!initiateResponse.ok) {
                    const errorText = await initiateResponse.text();
                    throw new Error(`PDF upload initiation failed (${initiateResponse.status}): ${errorText}`);
                }

                const uploadUrl = initiateResponse.headers.get('Location');
                if (!uploadUrl) {
                    throw new Error('No upload URL received for PDF');
                }

                results.pdfUpload.step = 'Uploading PDF content';

                // Step 2: Upload PDF content
                const uploadResponse = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/pdf'
                    },
                    body: pdfContent
                });

                if (!uploadResponse.ok) {
                    const errorText = await uploadResponse.text();
                    throw new Error(`PDF content upload failed (${uploadResponse.status}): ${errorText}`);
                }

                const uploadResult = await uploadResponse.json();
                
                results.pdfUpload.success = true;
                results.pdfUpload.step = 'Complete';
                results.pdfUpload.message = `PDF uploaded to invoices folder: ${fileName}`;
                results.pdfUpload.fileId = uploadResult.id;
                results.pdfUpload.fileName = uploadResult.name;

            } catch (error) {
                results.pdfUpload.success = false;
                results.pdfUpload.message = 'PDF upload test failed';
                results.pdfUpload.error = error.message;
            }
        }

        // Test Google Sheets
        if (sheetsToken) {
            try {
                results.sheets.step = 'Checking spreadsheet ID';
                
                const SPREADSHEET_ID = Deno.env.get("GOOGLE_SPREADSHEET_ID");
                
                if (!SPREADSHEET_ID) {
                    throw new Error('GOOGLE_SPREADSHEET_ID environment variable not set');
                }

                results.sheets.step = 'Testing Sheets write';
                results.sheets.spreadsheetId = SPREADSHEET_ID;

                const SHEET_NAME = 'Orders';
                const testRow = [
                    'TEST-' + new Date().getTime(),
                    'Test Household',
                    100,
                    10,
                    'ILS',
                    'test',
                    new Date().toISOString(),
                    '9999',
                    'test-vendor'
                ];

                const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=RAW`;
                
                const sheetsResponse = await fetch(sheetsUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${sheetsToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        values: [testRow]
                    })
                });

                if (!sheetsResponse.ok) {
                    const errorText = await sheetsResponse.text();
                    throw new Error(`Sheets write failed (${sheetsResponse.status}): ${errorText}`);
                }

                const sheetsResult = await sheetsResponse.json();
                
                results.sheets.success = true;
                results.sheets.step = 'Complete';
                results.sheets.message = `Test row added to ${SHEET_NAME}`;
                results.sheets.updatedRange = sheetsResult.updates?.updatedRange;
                results.sheets.updatedRows = sheetsResult.updates?.updatedRows;

            } catch (error) {
                results.sheets.success = false;
                results.sheets.message = 'Sheets test failed';
                results.sheets.error = error.message;
            }
        }

        return Response.json({ 
            success: true,
            results: results
        });

    } catch (error) {
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack,
            results 
        }, { status: 500 });
    }
});