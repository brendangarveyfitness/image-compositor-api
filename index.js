const express = require('express');
const sharp = require('sharp');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Image Compositor API is running!' });
});

// Composite endpoint
app.post('/composite', async (req, res) => {
  try {
    const { aiImage, headerTemplate, footerTemplate } = req.body;

    // Validate inputs exist
    if (!aiImage || !headerTemplate || !footerTemplate) {
      return res.status(400).json({ 
        error: 'Missing required images. Need: aiImage, headerTemplate, footerTemplate' 
      });
    }

    // Clean base64 strings (remove whitespace, newlines, etc)
    const cleanAI = aiImage.replace(/\s/g, '');
    const cleanHeader = headerTemplate.replace(/\s/g, '');
    const cleanFooter = footerTemplate.replace(/\s/g, '');

    // Validate base64 strings are not empty after cleaning
    if (!cleanAI || !cleanHeader || !cleanFooter) {
      return res.status(400).json({ 
        error: 'One or more base64 strings are empty after cleaning' 
      });
    }

    console.log('AI Image length:', cleanAI.length);
    console.log('Header length:', cleanHeader.length);
    console.log('Footer length:', cleanFooter.length);

    // Decode base64 images to buffers
    let aiBuffer, headerBuffer, footerBuffer;
    
    try {
      aiBuffer = Buffer.from(cleanAI, 'base64');
      if (aiBuffer.length === 0) throw new Error('AI image buffer is empty');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid base64 for aiImage: ' + e.message });
    }

    try {
      headerBuffer = Buffer.from(cleanHeader, 'base64');
      if (headerBuffer.length === 0) throw new Error('Header buffer is empty');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid base64 for headerTemplate: ' + e.message });
    }

    try {
      footerBuffer = Buffer.from(cleanFooter, 'base64');
      if (footerBuffer.length === 0) throw new Error('Footer buffer is empty');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid base64 for footerTemplate: ' + e.message });
    }

    // Get AI image dimensions to verify it's the right size
    const aiMetadata = await sharp(aiBuffer).metadata();
    console.log('AI image dimensions:', aiMetadata.width, 'x', aiMetadata.height);

    // Resize AI image to exactly 1080×950 if it's not already
    const resizedAI = await sharp(aiBuffer)
      .resize(1080, 950, {
        fit: 'cover',
        position: 'center'
      })
      .toBuffer();

    console.log('AI image resized to 1080×950');

    // Create final composite image (1080×1350)
    // Stack: header (200px) + AI content (950px) + footer (200px)
    const finalImage = await sharp({
      create: {
        width: 1080,
        height: 1350,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([
      { input: headerBuffer, top: 0, left: 0 },      // Header: 0-200px
      { input: resizedAI, top: 200, left: 0 },       // Content: 200-1150px
      { input: footerBuffer, top: 1150, left: 0 }    // Footer: 1150-1350px
    ])
    .png()
    .toBuffer();

    // Return composited image as base64
    const base64Result = finalImage.toString('base64');

    console.log('Success! Composite image created, size:', base64Result.length);

    res.json({ 
      success: true,
      image: base64Result 
    });

  } catch (error) {
    console.error('Composite error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Image Compositor API running on port ${PORT}`);
});
