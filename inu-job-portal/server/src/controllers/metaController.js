const { query } = require('../config/db');
const { asyncHandler, ok } = require('../utils/http');
const { STATUSES } = require('../utils/statusWorkflow');

/** Public lookup data used by forms (departments, document types, enums). */
exports.lookups = asyncHandler(async (req, res) => {
  const [departments, documentTypes] = await Promise.all([
    query('SELECT id, name FROM departments ORDER BY name'),
    query('SELECT id, code, name FROM document_types ORDER BY id'),
  ]);
  ok(res, {
    departments,
    document_types: documentTypes,
    categories: ['academic', 'administrative', 'technical'],
    employment_types: ['full_time', 'part_time', 'contract'],
    application_statuses: STATUSES,
  });
});
