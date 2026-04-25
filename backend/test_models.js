const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Say hello");
    console.log(`[SUCCESS] ${modelName}:`, await result.response.text());
  } catch (err) {
    console.log(`[FAIL] ${modelName}:`, err.message);
  }
}

async function runTests() {
  await testModel('gemini-1.5-flash');
  await testModel('gemini-1.5-pro');
  await testModel('gemini-pro');
  await testModel('gemini-1.0-pro');
  await testModel('gemini-pro-vision');
  await testModel('gemini-1.5-flash-latest');
}

runTests();
