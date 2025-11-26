import { Router } from 'express';
import type { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import multer from 'multer';
import path from 'path';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload Avatar
router.post('/avatar', upload.single('file'), async (req: Request, res: Response) => {
    console.log('[Upload] Received avatar upload request');
    console.log('[Upload] Auth header:', req.headers.authorization ? 'Present' : 'Missing');
    console.log('[Upload] File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'Missing');

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('[Upload] Unauthorized - missing or invalid auth header');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
        console.log('[Upload] No file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const file = req.file;
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload to Supabase Storage
        let { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) {
            console.error('Supabase upload error:', error);

            // Try to create bucket if not found
            if (error.message.includes('Bucket not found') || error.message.includes('The resource was not found') || (error as any).statusCode === '404') {
                console.log('Attempting to create avatars bucket...');
                const { data: bucketData, error: bucketError } = await supabase.storage.createBucket('avatars', {
                    public: true
                });
                if (bucketError) {
                    console.error('Failed to create bucket:', bucketError);
                    return res.status(500).json({ error: 'Storage bucket missing and creation failed: ' + bucketError.message });
                }
                // Retry upload
                const retry = await supabase.storage
                    .from('avatars')
                    .upload(filePath, file.buffer, {
                        contentType: file.mimetype,
                        upsert: false
                    });
                data = retry.data;
                error = retry.error;

                if (error) {
                    console.error('Retry upload failed:', error);
                    return res.status(500).json({ error: 'Upload failed after bucket creation: ' + error.message });
                }
            } else {
                return res.status(500).json({ error: 'Upload failed: ' + error.message });
            }
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        res.json({ url: publicUrl });

    } catch (err: any) {
        console.error('Upload handler error:', err);
        res.status(500).json({ error: err.message || 'Upload failed' });
    }
});

export default router;
