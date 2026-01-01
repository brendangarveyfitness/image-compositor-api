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

    if (!aiImage || !headerTemplate || !footerTemplate) {
      return res.status(400).json({ 
        error: 'Missing required images. Need: aiImage, headerTemplate, footerTemplate' 
      });
    }

    // Decode base64 images to buffers
    const aiBuffer = Buffer.from(aiImage, 'base64');
    const headerBuffer = Buffer.from(headerTemplate, 'base64');
    const footerBuffer = Buffer.from(footerTemplate, 'base64');

    // Crop AI image (remove top 200px and bottom 200px, keep middle 950px)
    const croppedAI = await sharp(aiBuffer)
      .extract({ 
        left: 0, 
        top: 200,      // Skip AI's header (200px)
        width: 1080, 
        height: 950    // Take middle content only (950px)
      })
      .toBuffer();

    // Create final composite image (1080×1350)
    const finalImage = await sharp({
      create: {
        width: 1080,
        height: 1350,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([
      { input: headerBuffer, top: 0, left: 0 },        // Header at top (0-200px)
      { input: croppedAI, top: 200, left: 0 },        // Content in middle (200-1150px)
      { input: footerBuffer, top: 1150, left: 0 }     // Footer at bottom (1150-1350px)
    ])
    .png()
    .toBuffer();

    // Return composited image as base64
    const base64Result = finalImage.toString('base64');

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
