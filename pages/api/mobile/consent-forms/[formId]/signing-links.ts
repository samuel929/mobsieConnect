import { z } from 'zod';

import { apiHandler, one } from '@/server/api';
import { AppError } from '@/server/errors';
import { getParent } from '@/server/parentAuth';
import { consentTemplateId, pactaRequest } from '@/server/pacta';

const inputSchema = z.object({ childName: z.string().trim().min(2).max(120) });

export default apiHandler<{ url: string }>({ methods: ['POST'], auth: false }, async (req, res) => {
  const parent = await getParent(req);
  const formId = one(req.query.formId);
  if (!formId || !/^[a-z0-9-]{3,80}$/.test(formId)) {
    throw new AppError(422, 'INVALID_FORM', 'A valid consent form is required.');
  }
  const input = inputSchema.parse(req.body);
  const templateId = consentTemplateId(formId);
  const result = await pactaRequest<Record<string, unknown>>(
    `/templates/${encodeURIComponent(templateId)}/direct-link`,
    {
      method: 'POST',
      body: JSON.stringify({
        recipient: { name: parent.name, email: parent.email, role: 'SIGNER' },
        variables: {
          childName: input.childName,
          guardianName: parent.name,
          guardianEmail: parent.email,
        },
      }),
    },
  );
  const url = String(result.url || result.directLinkUrl || result.signingUrl || '');
  if (!url.startsWith('https://')) {
    throw new AppError(502, 'INVALID_SIGNING_LINK', 'Pacta did not return a signing link.');
  }
  res.status(200).json({ ok: true, data: { url } });
});
