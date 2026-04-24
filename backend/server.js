const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const TRIAGE_SIGNAL_RULES = [
  { regex: /heavy bleeding|profuse bleeding|spurting blood|hemorrhage/i, label: 'Possible heavy bleeding pattern detected.', severities: ['Red'] },
  { regex: /unconscious|not responding|unresponsive|fainted|collapsed/i, label: 'Patient may be unresponsive.', severities: ['Red'] },
  { regex: /difficulty breathing|cannot breathe|shortness of breath|gasping|choking/i, label: 'Breathing distress indicators are present.', severities: ['Red'] },
  { regex: /severe burn|third[- ]degree burn|extensive burn|electrical burn/i, label: 'Severe burn indicators are present.', severities: ['Red'] },
  { regex: /spine|spinal|neck trauma|back trauma|paralysis/i, label: 'Possible spinal trauma indicators detected.', severities: ['Red'] },
  { regex: /fracture|broken|deformity|dislocated/i, label: 'Fracture or skeletal injury indicators are present.', severities: ['Yellow'] },
  { regex: /deep cut|deep laceration|open wound|gaping wound/i, label: 'Deep wound indicators are present.', severities: ['Yellow'] },
  { regex: /moderate bleeding|significant pain|severe pain|cannot move/i, label: 'Moderate-to-severe injury symptoms are present.', severities: ['Yellow'] },
  { regex: /minor cut|small cut|bruise|swelling|sprain|mild pain/i, label: 'Minor trauma indicators are present.', severities: ['Green'] }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const buildTriageInsight = ({ severity, injuryType, firstAidSteps, description }) => {
  const combinedText = `${description || ''} ${injuryType || ''} ${firstAidSteps || ''}`;
  const evidence = [];

  for (const rule of TRIAGE_SIGNAL_RULES) {
    if (rule.regex.test(combinedText)) {
      if (!rule.severities || rule.severities.includes(severity)) {
        evidence.push(rule.label);
      }
    }
  }

  let confidence = severity === 'Red' ? 0.78 : severity === 'Yellow' ? 0.74 : 0.7;

  if (!description || !description.trim()) {
    confidence -= 0.12;
  }

  if (evidence.length >= 2) {
    confidence += 0.1;
  } else if (evidence.length === 0) {
    confidence -= 0.08;
  }

  if (/^\s*1\./m.test(firstAidSteps || '')) {
    confidence += 0.03;
  }

  confidence = clamp(confidence, 0.55, 0.98);

  const fallbackEvidenceBySeverity = {
    Red: 'Severity marked Red because life-threatening indicators may be present.',
    Yellow: 'Severity marked Yellow because injury appears urgent but currently stable.',
    Green: 'Severity marked Green because signs suggest a minor non-urgent injury.'
  };

  const finalEvidence = evidence.length > 0 ? evidence.slice(0, 3) : [fallbackEvidenceBySeverity[severity]];
  const reviewRecommended = confidence < 0.72;

  return {
    confidence: Number(confidence.toFixed(2)),
    evidence: finalEvidence,
    review_recommended: reviewRecommended,
    review_reason: reviewRecommended
      ? 'Low confidence triage. Dispatcher verification is recommended.'
      : 'Confidence is acceptable for automated triage support.'
  };
};

app.post('/api/triage', async (req, res) => {
  console.log('Request received...');
  try {
    const { image, language = 'en-US', description = '' } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `You are an expert emergency medical AI triage assistant.
Analyze the injury image AND the bystander's verbal report: "${description || 'No description provided'}".

Determine SOS dispatch severity using these strict medical criteria:
- RED (Critical): Life-threatening - heavy bleeding, unconsciousness, suspected spinal injury, cardiac arrest, severe burns, difficulty breathing.
- YELLOW (Serious): Urgent but stable - moderate bleeding, fractures, deep lacerations, significant pain.
- GREEN (Minor): Non-urgent - minor cuts, bruises, mild sprains.

Return ONLY a single raw JSON object with exactly these keys and no extras:
{
  "severity": "Red" | "Yellow" | "Green",
  "injury_type": "<specific injury name in ${language} locale>",
  "first_aid_steps": "<numbered, practical first-aid steps in ${language} locale>"
}

Strict output rules:
- No markdown, no code fences, no explanation text.
- "severity" must be exactly one of: Red, Yellow, Green.
- "first_aid_steps" must be numbered steps (e.g., 1. ... 2. ... 3. ...).
- If uncertain between categories, choose the safer higher-severity category.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: image, mimeType: 'image/jpeg' } }
    ]);

    const response = await result.response;
    const text = response.text().trim();
    const cleanedText = text.replace(/```json|```/gi, '').trim();
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Model did not return a JSON object.');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const severityMap = { red: 'Red', yellow: 'Yellow', green: 'Green' };
    const normalizedSeverity = typeof parsed.severity === 'string'
      ? parsed.severity.trim().toLowerCase()
      : '';
    const severity = severityMap[normalizedSeverity];

    if (!severity) {
      throw new Error('Invalid severity returned by model.');
    }

    const injuryType = typeof parsed.injury_type === 'string' ? parsed.injury_type.trim() : '';
    const firstAidSteps = typeof parsed.first_aid_steps === 'string' ? parsed.first_aid_steps.trim() : '';

    if (!injuryType || !firstAidSteps) {
      throw new Error('Missing required triage fields from model.');
    }

    const insight = buildTriageInsight({
      severity,
      injuryType,
      firstAidSteps,
      description
    });

    res.json({
      data: {
        severity,
        injury_type: injuryType,
        first_aid_steps: firstAidSteps
      },
      insight
    });
  } catch (error) {
    console.error('BACKEND ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
