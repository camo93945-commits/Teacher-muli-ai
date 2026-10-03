import { json, sb, deviceId } from './_lib.js';

async function allowed(req) {
  const id = deviceId(req);
  if (!id) return false;

  const rows = await sb(
    'tm_access?device_id=eq.' +
    encodeURIComponent(id) +
    '&select=status,access_until&limit=1'
  );

  const a = rows[0];

  return !!a &&
    a.status === 'APPROVED' &&
    new Date(a.access_until) > new Date();
}

async function callAI(content) {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error('AI service is not configured yet.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    const r = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-6-luna',
          input: [
            {
              role: 'system',
              content: [{
                type: 'input_text',
                text:
                  'You are Teacher Muli AI, a patient Kenyan teacher for PP1 through Grade 9. Explain at the learner’s selected grade level. Help learners understand homework and assignments step by step. Use simple language for younger learners.'
              }]
            },
            {
              role: 'user',
              content
            }
          ]
        })
      }
    );

    const x = await r.json().catch(() => ({}));

    if (!r.ok) {
      throw new Error(
        x.error?.message || 'AI request failed'
      );
    }

    return x.output_text || 'No answer returned.';

  } catch (e) {
    if (e?.name === 'AbortError') {
      throw new Error(
        'AI request timed out. Please try again.'
      );
    }

    throw e;

  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req) {
  try {
    if (!(await allowed(req))) {
      return json(
        { error: 'learning_access_required' },
        403
      );
    }

    const ct = req.headers.get('content-type') || '';

    let grade = 'PP1';
    let kind = 'question';
    let question = '';
    let content = [];

    if (ct.includes('multipart/form-data')) {

      const f = await req.formData();

      grade = String(f.get('grade') || 'PP1');
      kind = 'homework_photo';
      question = String(f.get('question') || '');

      const img = f.get('image');

      if (!img || !img.arrayBuffer) {
        return json(
          { error: 'image_required' },
          400
        );
      }

      if ((img.size || 0) > 7 * 1024 * 1024) {
        return json(
          { error: 'image_too_large' },
          413
        );
      }

      const b = Buffer
        .from(await img.arrayBuffer())
        .toString('base64');

      content = [
        {
          type: 'input_text',
          text:
            `Learner grade: ${grade}. ${question}\n` +
            `Read the homework photo carefully. ` +
            `Transcribe the visible question, then solve ` +
            `it step by step at the learner's level.`
        },
        {
          type: 'input_image',
          image_url:
            `data:${img.type || 'image/jpeg'};base64,${b}`
        }
      ];

    } else {

      const body =
        await req.json().catch(() => ({}));

      grade = String(body.grade || 'PP1');
      kind = String(body.kind || 'question');
      question = String(body.question || '').trim();

      if (!question) {
        return json(
          { error: 'question_required' },
          400
        );
      }

      content = [{
        type: 'input_text',
        text:
          `Learner grade: ${grade}. ` +
          `Task type: ${kind}. ` +
          `Learner request: ${question}`
      }];
    }

    const answer = await callAI(content);

    return json({
      answer,
      grade,
      kind
    });

  } catch (e) {
    return json({
      error: e.message || 'ai_failed'
    }, 500);
  }
}
