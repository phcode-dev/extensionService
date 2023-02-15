// Refer https://json-schema.org/understanding-json-schema/index.html
const schema = {
    schema: {
        querystring: {
            type: 'object',
            required: ['name'],
            properties: {
                name: {
                    type: 'string',
                    minLength: 1,
                    maxLength: 10
                }
            }
        },
        response: {
            200: { //HTTP_STATUS_CODES.OK
                type: 'object',
                required: ['message'],
                properties: {
                    message: {type: 'string'}
                }
            }
        }
    }
};

export function getHelloSchema() {
    return schema;
}

export async function hello(request, _reply) {
    const name = request.query.name;
    const response = {
        message: `hello ${name}`
    };
    return response;
}
