/**
 * validate({ params, query, body }) checks each part of the request against a zod
 * schema and stores the cleaned result in req.valid. Controllers read req.valid,
 * never the raw req.body.
 */
function validate(schemas) {
  return (req, res, next) => {
    try {
      req.valid = {};
      for (const key of ['params', 'query', 'body']) {
        if (schemas[key]) req.valid[key] = schemas[key].parse(req[key] || {});
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = validate;
