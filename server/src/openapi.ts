export function getOpenApiSpec() {
  const base = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return {
    openapi: '3.1.0',
    info: { title: 'Study Planner API', version: '0.1.0' },
    servers: [{ url: base }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: { error: { type: 'string' } },
          required: ['error'],
        },
        Share: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            token: { type: 'string' },
            scope: { type: 'string', enum: ['blocks_only', 'full'] },
            expires_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
          },
          required: ['id', 'token', 'scope', 'expires_at'],
        },
        CreateShareRequest: {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: ['blocks_only', 'full'] },
            expires_in_days: { type: 'integer', minimum: 1, maximum: 365 },
            expires_at: { type: 'string', format: 'date-time' },
          },
          required: ['scope'],
        },
        CreateShareResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            token: { type: 'string' },
            scope: { type: 'string', enum: ['blocks_only', 'full'] },
            expires_at: { type: 'string', format: 'date-time' },
            url: { type: 'string', format: 'uri' },
          },
          required: ['id', 'token', 'scope', 'expires_at', 'url'],
        },
        ShareList: {
          type: 'object',
          properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Share' } } },
          required: ['items'],
        },
        Block: {
          type: 'object',
          properties: {
            start_at: { type: 'string', format: 'date-time' },
            end_at: { type: 'string', format: 'date-time' },
            task_id: { type: 'string', nullable: true },
          },
          required: ['start_at', 'end_at'],
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string', nullable: true },
            color: { type: 'string', nullable: true },
            due_at: { type: 'string', format: 'date-time', nullable: true },
            estimate_min: { type: 'integer', nullable: true },
            priority: { type: 'integer', nullable: true },
            recurrence_rule: { type: 'string', nullable: true },
            status: { type: 'string' },
            scheduling_status: { type: 'string', nullable: true },
          },
          required: ['id', 'title', 'status'],
        },
        SharedMeta: {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: ['blocks_only', 'full'] },
            expires_at: { type: 'string', format: 'date-time' },
          },
          required: ['scope', 'expires_at'],
        },
        SharedViewResponse: {
          type: 'object',
          properties: {
            share: { $ref: '#/components/schemas/SharedMeta' },
            tasks: { type: 'array', items: { $ref: '#/components/schemas/Task' }, nullable: true },
            blocks: { type: 'array', items: { $ref: '#/components/schemas/Block' } },
          },
          required: ['share', 'blocks'],
        },
        CopyBlocksResponse: {
          type: 'object',
          properties: { created_blocks: { type: 'integer' } },
          required: ['created_blocks'],
        },
        CopyFullResponse: {
          type: 'object',
          properties: { created_tasks: { type: 'integer' }, created_blocks: { type: 'integer' } },
          required: ['created_blocks', 'created_tasks'],
        },
        JoinRequestCreateRequest: {
          type: 'object',
          properties: { invite_code: { type: 'string' } },
          required: ['invite_code'],
        },
        JoinRequest: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            class_id: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
          },
          required: ['id', 'class_id', 'status'],
        },
        JoinRequestsList: {
          type: 'object',
          properties: { items: { type: 'array', items: { $ref: '#/components/schemas/JoinRequest' } } },
          required: ['items'],
        },
        JoinRequestStatus: {
          type: 'object',
          properties: { status: { type: 'string', enum: ['pending', 'approved', 'rejected'] } },
          required: ['status'],
        },
        Member: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            nickname: { type: 'string', nullable: true },
            joined_at: { type: 'string', format: 'date-time' },
          },
          required: ['user_id', 'joined_at'],
        },
        MembersList: {
          type: 'object',
          properties: { members: { type: 'array', items: { $ref: '#/components/schemas/Member' } } },
          required: ['members'],
        },
        BootstrapClassRequest: {
          type: 'object',
          properties: {
            admin_email: { type: 'string', format: 'email' },
            school_name: { type: 'string' },
            class_name: { type: 'string' },
            join_code: { type: 'string' },
          },
          required: ['admin_email', 'school_name', 'class_name', 'join_code'],
        },
        BootstrapClassResponse: {
          type: 'object',
          properties: { school_id: { type: 'string' }, class_id: { type: 'string' } },
          required: ['school_id', 'class_id'],
        },
        MessageResponse: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
        },
        CaptchaResponse: {
          type: 'object',
          properties: { id: { type: 'string' }, svg: { type: 'string' } },
          required: ['id', 'svg'],
        },
        SignupRequest: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
            nickname: { type: 'string' },
          },
          required: ['email', 'password', 'nickname'],
        },
        VerifyEmailRequest: {
          type: 'object',
          properties: { token: { type: 'string' } },
          required: ['token'],
        },
        LoginRequest: {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 } },
          required: ['email', 'password'],
        },
        LoginResponse: {
          type: 'object',
          properties: { token: { type: 'string' } },
          required: ['token'],
        },
        RequestPasswordResetRequest: {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } },
          required: ['email'],
        },
        ResetPasswordRequest: {
          type: 'object',
          properties: { token: { type: 'string' }, new_password: { type: 'string', minLength: 6 } },
          required: ['token', 'new_password'],
        },
        PatchNicknameRequest: {
          type: 'object',
          properties: {
            nickname: { type: 'string' },
            captcha_id: { type: 'string' },
            captcha_answer: { type: 'string' },
          },
          required: ['nickname', 'captcha_id', 'captcha_answer'],
        },
        CreateTaskRequest: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            type: { type: 'string', nullable: true },
            color: { type: 'string', nullable: true },
            due_at: { type: 'string', format: 'date-time', nullable: true },
            estimate_min: { type: 'integer', nullable: true },
            priority: { type: 'integer', nullable: true },
            recurrence_rule: { type: 'string', nullable: true },
          },
          required: ['title'],
        },
        UpdateTaskRequest: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            type: { type: 'string', nullable: true },
            color: { type: 'string', nullable: true },
            due_at: { type: 'string', format: 'date-time', nullable: true },
            estimate_min: { type: 'integer', nullable: true },
            priority: { type: 'integer', nullable: true },
            recurrence_rule: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['open', 'done'] },
          },
          additionalProperties: false,
        },
        TaskCreateResponse: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        TasksList: {
          type: 'object',
          properties: { items: { type: 'array', items: { $ref: '#/components/schemas/Task' } } },
          required: ['items'],
        },
        TasksDailyResponse: {
          type: 'object',
          properties: {
            today: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
            overdue: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
          },
          required: ['today', 'overdue'],
        },
        BlockRow: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            start_at: { type: 'string', format: 'date-time' },
            end_at: { type: 'string', format: 'date-time' },
            task_id: { type: 'string', nullable: true },
          },
          required: ['id', 'start_at', 'end_at'],
        },
        CreateBlockRequest: {
          type: 'object',
          properties: {
            start_at: { type: 'string', format: 'date-time' },
            end_at: { type: 'string', format: 'date-time' },
            task_id: { type: 'string', nullable: true },
          },
          required: ['start_at', 'end_at'],
        },
        UpdateBlockRequest: {
          type: 'object',
          properties: {
            start_at: { type: 'string', format: 'date-time' },
            end_at: { type: 'string', format: 'date-time' },
            task_id: { type: 'string', nullable: true },
          },
        },
        BlockCreateResponse: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
        BlocksList: {
          type: 'object',
          properties: { items: { type: 'array', items: { $ref: '#/components/schemas/BlockRow' } } },
          required: ['items'],
        },
        PushPublicKey: {
          type: 'object',
          properties: { key: { type: 'string' } },
          required: ['key'],
        },
        PushSubscribeRequest: {
          type: 'object',
          properties: {
            endpoint: { type: 'string', format: 'uri' },
            keys: { type: 'object', properties: { p256dh: { type: 'string' }, auth: { type: 'string' } }, required: ['p256dh', 'auth'] },
            userAgent: { type: 'string' },
          },
          required: ['endpoint', 'keys'],
        },
        NotificationTestResult: {
          type: 'object',
          properties: { endpoint: { type: 'string', format: 'uri' }, ok: { type: 'boolean' }, error: { type: 'string', nullable: true } },
          required: ['endpoint', 'ok'],
        },
        NotificationTestResponse: {
          type: 'object',
          properties: { results: { type: 'array', items: { $ref: '#/components/schemas/NotificationTestResult' } } },
          required: ['results'],
        },
      },
    },
    security: [],
    paths: {
      '/shares': {
        post: {
          summary: 'Create a share link',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateShareRequest' } } },
          },
          responses: {
            '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateShareResponse' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        get: {
          summary: 'List share links',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/ShareList' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/shares/{id}': {
        delete: {
          summary: 'Delete a share link',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/shared/{token}': {
        get: {
          summary: 'View shared content',
          parameters: [
            { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'date', in: 'query', required: false, schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/SharedViewResponse' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '410': { description: 'Expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/shared/{token}/copy': {
        post: {
          summary: 'Copy shared content into my plan',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'date', in: 'query', required: true, schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } },
          ],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { oneOf: [ { $ref: '#/components/schemas/CopyBlocksResponse' }, { $ref: '#/components/schemas/CopyFullResponse' } ] },
                },
              },
            },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '410': { description: 'Expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/classes/join-requests': {
        post: {
          summary: 'Create join request with invite code',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/JoinRequestCreateRequest' } } },
          },
          responses: {
            '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/JoinRequest' } } } },
            '400': { description: 'InvalidCode or Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '409': { description: 'DuplicatePending or AlreadyMember', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/classes/{class_id}/join-requests': {
        get: {
          summary: 'List join requests for a class',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'class_id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/JoinRequestsList' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/classes/{class_id}/join-requests/{request_id}/approve': {
        post: {
          summary: 'Approve a join request',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'class_id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'request_id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/JoinRequestStatus' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/classes/{class_id}/join-requests/{request_id}/reject': {
        post: {
          summary: 'Reject a join request',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'class_id', in: 'path', required: true, schema: { type: 'string' } },
            { name: 'request_id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/JoinRequestStatus' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '409': { description: 'Conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/classes/{class_id}/members': {
        get: {
          summary: 'List class members',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'class_id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MembersList' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Forbidden', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/dev/bootstrap-class': {
        post: {
          summary: 'Development bootstrap for school and class',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/BootstrapClassRequest' } } },
          },
          responses: {
            '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/BootstrapClassResponse' } } } },
            '400': { description: 'AdminUserNotFound or Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Not available in production', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/captcha': {
        get: {
          summary: 'Get CAPTCHA svg',
          responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/CaptchaResponse' } } } } },
        },
      },
      '/auth/signup': {
        post: {
          summary: 'Signup with email/password',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } } },
          responses: {
            '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '409': { description: 'Email already registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/verify-email': {
        post: {
          summary: 'Verify email with token',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/VerifyEmailRequest' } } } },
          responses: {
            '200': { description: 'Verified', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '400': { description: 'Token invalid or expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/login': {
        post: {
          summary: 'Login and get JWT',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
            '400': { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Email not verified', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/request-password-reset': {
        post: {
          summary: 'Request password reset',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RequestPasswordResetRequest' } } } },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
          },
        },
      },
      '/auth/reset-password': {
        post: {
          summary: 'Reset password',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ResetPasswordRequest' } } } },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '400': { description: 'Token invalid or expired', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/profile/nickname': {
        patch: {
          summary: 'Update nickname with CAPTCHA',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PatchNicknameRequest' } } } },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '400': { description: 'Invalid input or captcha', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/tasks': {
        post: {
          summary: 'Create task',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTaskRequest' } } } },
          responses: {
            '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskCreateResponse' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        get: {
          summary: 'List tasks',
          security: [{ bearerAuth: [] }],
          parameters: [ { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'done'] } } ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TasksList' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/tasks/daily': {
        get: {
          summary: 'Get today and overdue tasks for a date',
          security: [{ bearerAuth: [] }],
          parameters: [ { name: 'date', in: 'query', required: true, schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/TasksDailyResponse' } } } },
            '400': { description: 'Missing date', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/tasks/{id}': {
        patch: {
          summary: 'Update task',
          security: [{ bearerAuth: [] }],
          parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateTaskRequest' } } } },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          summary: 'Delete task',
          security: [{ bearerAuth: [] }],
          parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/blocks': {
        post: {
          summary: 'Create time block',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateBlockRequest' } } } },
          responses: {
            '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/BlockCreateResponse' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '409': { description: 'Time conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/blocks/daily': {
        get: {
          summary: 'List time blocks for a day',
          security: [{ bearerAuth: [] }],
          parameters: [ { name: 'date', in: 'query', required: true, schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' } } ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/BlocksList' } } } },
            '400': { description: 'Missing date', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/blocks/{id}': {
        patch: {
          summary: 'Update time block',
          security: [{ bearerAuth: [] }],
          parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateBlockRequest' } } } },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '400': { description: 'Invalid input', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '409': { description: 'Time conflict', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          summary: 'Delete time block',
          security: [{ bearerAuth: [] }],
          parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/push/public-key': {
        get: {
          summary: 'Get VAPID public key',
          responses: { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PushPublicKey' } } } } },
        },
      },
      '/push/subscribe': {
        post: {
          summary: 'Save or update a push subscription',
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PushSubscribeRequest' } } } },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/MessageResponse' } } } },
            '400': { description: 'Invalid subscription', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/notifications/test': {
        post: {
          summary: 'Send a test push notification to all subscriptions of current user',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationTestResponse' } } } },
            '400': { description: 'No subscription', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '401': { description: 'Unauthorized', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    },
  } as const;
}
