import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();

// `ajv` doesn't understand complex formats by default,
// they need to be added using `ajv-formats`
addFormats(ajv, ['date', 'uri', 'uri-reference']);

// `ajv` needs to know about every schema,
// so load and add them all before creating the `ValidateFunction`
const schemaNames = [
	'policy',
	'policy-version',
	'policy-version-file',
	'policy-version-duration',
	'provenance',
	'accessibility',
	'accessibility-feature',
	'notice',
	'licence',
].map((name) => `${name}.schema.json`);

const schemaPromises = schemaNames.map(async (name) => {
	return (await import(`./${name}`, {
		assert: { type: 'json' },
	})).default;
});

const schemas = await Promise.all(schemaPromises);

for (const [i, schema] of schemas.entries()) {
	const name = schemaNames[i];

	ajv.addSchema(schema, name);
}

const validatePolicy = ajv.compile(schemas[0]);

export { validatePolicy };
