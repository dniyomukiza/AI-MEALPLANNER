const express = require('express');
const multer = require('multer');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
require('dotenv').config();


const app = express();
const upload = multer({ dest: 'uploads/' });


app.use(express.static(path.join(__dirname, '..', 'my-app', 'public')));

const genAI = new GoogleGenerativeAI(process.env.API_KEY);

function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

app.post('/analyze-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image file.' });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = "What are the food items you see in this image?";
    const imageParts = [fileToGenerativePart(req.file.path, req.file.mimetype)];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();
    
 
    fs.unlinkSync(req.file.path);

    res.json({ items: text });

  } catch (error) {
    console.log('Error analyzing image:', error);
    res.status(500).json({
        error: 'Image analysis failed.',
        details: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
