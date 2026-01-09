import { createClientFromRequest } from 'npm:@base44/sdk@0.5.0';
import * as zip from 'https://deno.land/x/zipjs@v2.7.45/index.js';
import { posix as path } from 'https://deno.land/std@0.177.0/path/mod.ts';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const sdk = base44.asServiceRole;

    try {
        if (!(await base44.auth.isAuthenticated())) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }
        
        const { zip_file_url } = await req.json();
        if (!zip_file_url) {
            return new Response(JSON.stringify({ error: 'zip_file_url is required' }), { status: 400 });
        }

        // Fetch the ZIP file from the provided URL
        const response = await fetch(zip_file_url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ZIP file: ${response.statusText}`);
        }
        const zipBlob = await response.blob();
        
        const zipReader = new zip.ZipReader(new zip.BlobReader(zipBlob));
        const entries = await zipReader.getEntries();
        
        const results = [];
        const headers = ['product_name', 'image_url'];
        
        for (const entry of entries) {
            // Skip directories and MacOS resource fork files
            if (entry.directory || entry.filename.startsWith('__MACOSX/')) {
                continue;
            }

            // Get the file content as a Blob
            const fileBlob = await entry.getData(new zip.BlobWriter());

            // Upload the individual file to Base44 storage
            const uploadResult = await sdk.integrations.Core.UploadFile({
                file: fileBlob,
                // Pass filename to preserve it
                filename: entry.filename
            });

            // Extract SKU from the filename (removes extension)
            const sku = path.basename(entry.filename, path.extname(entry.filename));
            
            results.push({
                product_name: sku,
                image_url: uploadResult.file_url
            });
        }
        
        await zipReader.close();

        // Generate CSV content
        const csvRows = results.map(row => 
            `"${row.product_name.replace(/"/g, '""')}","${row.image_url.replace(/"/g, '""')}"`
        );
        const csvContent = [headers.join(','), ...csvRows].join('\n');

        return new Response(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': 'attachment; filename="image_mapping_output.csv"'
            }
        });

    } catch (error) {
        console.error("Error processing zip file:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});