import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const results = {
        drive: { success: false, step: '', message: '', error: null },
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