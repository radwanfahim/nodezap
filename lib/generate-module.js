'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');

async function generateModule(type, name) {
  const pascalName = toPascal(name);
  const camelName = toCamel(name);
  const kebabName = toKebab(name);

  // Detect project config from package.json
  const cwd = process.cwd();
  const srcDir = path.join(cwd, 'src');

  if (!fs.existsSync(srcDir)) {
    console.log(chalk.red('\n  ✖ No src/ directory found. Run from your project root.\n'));
    process.exit(1);
  }

  const isModular = fs.existsSync(path.join(srcDir, 'modules'));
  const arch = isModular ? 'modular' : 'mvc';

  console.log(chalk.bold.hex('#F7C59F')(`\n  Generating ${type}: ${chalk.white(pascalName)}\n`));

  const spinner = ora({ text: chalk.dim('  Writing files…'), spinner: 'dots2' }).start();

  try {
    if (type === 'module') {
      await genFullModule(srcDir, arch, name, pascalName, camelName, kebabName);
    } else if (type === 'controller') {
      await genController(srcDir, arch, name, pascalName, camelName);
    } else if (type === 'route') {
      await genRoute(srcDir, arch, name, pascalName, camelName, kebabName);
    } else {
      spinner.fail(chalk.red(`Unknown type: ${type}`));
      console.log(chalk.dim('  Valid types: module, controller, route'));
      process.exit(1);
    }

    spinner.succeed(chalk.green(`  ${pascalName} ${type} created`));
    printModuleSuccess(type, name, arch, srcDir, kebabName);
  } catch (err) {
    spinner.fail(chalk.red('  Generation failed'));
    throw err;
  }
}

// ─── Full Module (controller + route + service + model) ──────────────────────

async function genFullModule(srcDir, arch, name, pascal, camel, kebab) {
  if (arch === 'modular') {
    const moduleDir = path.join(srcDir, 'modules', camel);
    fs.ensureDirSync(moduleDir);
    fs.writeFileSync(path.join(moduleDir, `${camel}.controller.js`), controllerTemplate(pascal, camel, '../../'));
    fs.writeFileSync(path.join(moduleDir, `${camel}.routes.js`), routeTemplate(pascal, camel, kebab, '../../', `./${camel}.controller`));
    fs.writeFileSync(path.join(moduleDir, `${camel}.service.js`), serviceTemplate(pascal));
    fs.writeFileSync(path.join(moduleDir, `${camel}.model.js`), modelTemplate(pascal));
    fs.writeFileSync(path.join(moduleDir, `${camel}.validation.js`), validationTemplate(camel));
  } else {
    fs.writeFileSync(path.join(srcDir, 'controllers', `${camel}.controller.js`), controllerTemplate(pascal, camel, '../'));
    fs.writeFileSync(path.join(srcDir, 'routes', `${camel}.routes.js`), routeTemplate(pascal, camel, kebab, '../', `../controllers/${camel}.controller`));
    fs.writeFileSync(path.join(srcDir, 'services', `${camel}.service.js`), serviceTemplate(pascal));
    fs.writeFileSync(path.join(srcDir, 'models', `${camel}.model.js`), modelTemplate(pascal));
  }

  // Update routes/index.js
  updateRoutesIndex(srcDir, camel, kebab, arch);
}

async function genController(srcDir, arch, name, pascal, camel) {
  const dir = arch === 'modular'
    ? path.join(srcDir, 'modules', camel)
    : path.join(srcDir, 'controllers');
  fs.ensureDirSync(dir);
  const relBase = arch === 'modular' ? '../../' : '../';
  fs.writeFileSync(path.join(dir, `${camel}.controller.js`), controllerTemplate(pascal, camel, relBase));
}

async function genRoute(srcDir, arch, name, pascal, camel, kebab) {
  const dir = arch === 'modular'
    ? path.join(srcDir, 'modules', camel)
    : path.join(srcDir, 'routes');
  fs.ensureDirSync(dir);
  const relBase = arch === 'modular' ? '../../' : '../';
  const ctrlPath = arch === 'modular' ? `./${camel}.controller` : `../controllers/${camel}.controller`;
  fs.writeFileSync(path.join(dir, `${camel}.routes.js`), routeTemplate(pascal, camel, kebab, relBase, ctrlPath));
}

// ─── Templates ───────────────────────────────────────────────────────────────

function controllerTemplate(pascal, camel, relBase) {
  return `const { StatusCodes } = require('http-status-codes');
const { sendSuccess, sendPaginated } = require('${relBase}utils/response');
const AppError = require('${relBase}utils/AppError');
// const ${pascal}Service = require('./${camel}.service');

/**
 * @swagger
 * tags:
 *   name: ${pascal}
 *   description: ${pascal} management
 */

/**
 * @swagger
 * /${camel}s:
 *   get:
 *     summary: List all ${camel}s
 *     tags: [${pascal}]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: ${pascal} list
 */
const getAll${pascal}s = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  // const { data, total } = await ${pascal}Service.findAll({ page, limit });
  const data = [];
  const total = 0;
  sendPaginated(res, data, { page, limit, total, totalPages: Math.ceil(total / limit) });
};

/**
 * @swagger
 * /${camel}s/{id}:
 *   get:
 *     summary: Get ${camel} by ID
 *     tags: [${pascal}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 */
const get${pascal}ById = async (req, res) => {
  const { id } = req.params;
  // const item = await ${pascal}Service.findById(id);
  // if (!item) throw new AppError('${pascal} not found', StatusCodes.NOT_FOUND);
  sendSuccess(res, { id }, '${pascal} retrieved');
};

/**
 * @swagger
 * /${camel}s:
 *   post:
 *     summary: Create ${camel}
 *     tags: [${pascal}]
 */
const create${pascal} = async (req, res) => {
  // const item = await ${pascal}Service.create(req.body);
  sendSuccess(res, req.body, '${pascal} created', StatusCodes.CREATED);
};

/**
 * @swagger
 * /${camel}s/{id}:
 *   patch:
 *     summary: Update ${camel}
 *     tags: [${pascal}]
 */
const update${pascal} = async (req, res) => {
  const { id } = req.params;
  // const item = await ${pascal}Service.update(id, req.body);
  // if (!item) throw new AppError('${pascal} not found', StatusCodes.NOT_FOUND);
  sendSuccess(res, { id, ...req.body }, '${pascal} updated');
};

/**
 * @swagger
 * /${camel}s/{id}:
 *   delete:
 *     summary: Delete ${camel}
 *     tags: [${pascal}]
 */
const delete${pascal} = async (req, res) => {
  const { id } = req.params;
  // await ${pascal}Service.remove(id);
  sendSuccess(res, null, '${pascal} deleted');
};

module.exports = { getAll${pascal}s, get${pascal}ById, create${pascal}, update${pascal}, delete${pascal} };
`;
}

function routeTemplate(pascal, camel, kebab, relBase, ctrlPath) {
  return `const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('${relBase}middleware/validate');
// const { authenticate, authorize } = require('${relBase}middleware/auth');
const {
  getAll${pascal}s,
  get${pascal}ById,
  create${pascal},
  update${pascal},
  delete${pascal},
} = require('${ctrlPath}');

const router = Router();

// router.use(authenticate); // uncomment to protect all routes

/**
 * @route   GET /${kebab}s
 * @access  Public
 */
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validate,
  getAll${pascal}s
);

/**
 * @route   GET /${kebab}s/:id
 * @access  Public
 */
router.get('/:id',
  param('id').notEmpty().withMessage('ID is required'),
  validate,
  get${pascal}ById
);

/**
 * @route   POST /${kebab}s
 * @access  Protected
 */
router.post('/',
  // authenticate,
  body('name').notEmpty().withMessage('Name is required'),
  validate,
  create${pascal}
);

/**
 * @route   PATCH /${kebab}s/:id
 * @access  Protected
 */
router.patch('/:id',
  // authenticate,
  param('id').notEmpty(),
  validate,
  update${pascal}
);

/**
 * @route   DELETE /${kebab}s/:id
 * @access  Admin
 */
router.delete('/:id',
  // authenticate,
  // authorize('admin'),
  param('id').notEmpty(),
  validate,
  delete${pascal}
);

module.exports = router;
`;
}

function serviceTemplate(pascal) {
  return `/**
 * ${pascal} Service — business logic layer
 * Connect your DB queries / ORM calls here.
 */
const ${pascal}Service = {
  async findAll({ page = 1, limit = 20, filters = {} } = {}) {
    // TODO: implement
    // const [data, total] = await Promise.all([
    //   ${pascal}.find(filters).skip((page - 1) * limit).limit(limit),
    //   ${pascal}.countDocuments(filters),
    // ]);
    return { data: [], total: 0 };
  },

  async findById(id) {
    // TODO: return ${pascal}.findById(id);
    return null;
  },

  async create(data) {
    // TODO: return ${pascal}.create(data);
    return data;
  },

  async update(id, data) {
    // TODO: return ${pascal}.findByIdAndUpdate(id, data, { new: true });
    return { id, ...data };
  },

  async remove(id) {
    // TODO: return ${pascal}.findByIdAndDelete(id);
    return true;
  },
};

module.exports = ${pascal}Service;
`;
}

function modelTemplate(pascal) {
  const camel = pascal[0].toLowerCase() + pascal.slice(1);
  return `/**
 * ${pascal} Model
 * Mongoose example — replace with your ORM/DB of choice.
 */
// const mongoose = require('mongoose');

// const ${camel}Schema = new mongoose.Schema({
//   name: { type: String, required: true, trim: true },
//   description: { type: String },
//   isActive: { type: Boolean, default: true },
// }, { timestamps: true });

// module.exports = mongoose.model('${pascal}', ${camel}Schema);

// Placeholder until you connect a DB:
module.exports = {};
`;
}

function validationTemplate(camel) {
  const pascal = camel[0].toUpperCase() + camel.slice(1);
  return `const { body, param } = require('express-validator');

const create${pascal}Rules = [
  body('name').notEmpty().withMessage('Name is required').trim(),
];

const update${pascal}Rules = [
  param('id').notEmpty().withMessage('ID is required'),
  body('name').optional().notEmpty().trim(),
];

module.exports = { create${pascal}Rules, update${pascal}Rules };
`;
}

// ─── Update routes/index.js ──────────────────────────────────────────────────

function updateRoutesIndex(srcDir, camel, kebab, arch) {
  const indexPath = path.join(srcDir, 'routes', 'index.js');
  if (!fs.existsSync(indexPath)) return;

  let content = fs.readFileSync(indexPath, 'utf8');
  const routePath = arch === 'modular'
    ? `../modules/${camel}/${camel}.routes`
    : `./${camel}.routes`;

  const importLine = `const ${camel}Routes = require('${routePath}');`;
  const useLine = `router.use('/${kebab}s', ${camel}Routes);`;

  if (!content.includes(importLine)) {
    // Insert import after first require line
    content = content.replace(
      /(const \{ Router \}.*;\n)/,
      `$1${importLine}\n`
    );
    // Insert router.use before module.exports
    content = content.replace(
      /(module\.exports)/,
      `${useLine}\n\n$1`
    );
    fs.writeFileSync(indexPath, content);
  }
}

// ─── Success message ──────────────────────────────────────────────────────────

function printModuleSuccess(type, name, arch, srcDir, kebab) {
  const camel = toCamel(name);
  console.log();
  if (type === 'module') {
    if (arch === 'modular') {
      console.log(chalk.dim(`  src/modules/${camel}/`));
      console.log(chalk.dim(`    ├── ${camel}.controller.js`));
      console.log(chalk.dim(`    ├── ${camel}.routes.js`));
      console.log(chalk.dim(`    ├── ${camel}.service.js`));
      console.log(chalk.dim(`    ├── ${camel}.model.js`));
      console.log(chalk.dim(`    └── ${camel}.validation.js`));
    } else {
      console.log(chalk.dim(`  src/controllers/${camel}.controller.js`));
      console.log(chalk.dim(`  src/routes/${camel}.routes.js`));
      console.log(chalk.dim(`  src/services/${camel}.service.js`));
      console.log(chalk.dim(`  src/models/${camel}.model.js`));
    }
    console.log();
    console.log(chalk.hex('#F7C59F')(`  ✦ Routes auto-registered at /api/v1/${kebab}s`));
  }
  console.log();
}

// ─── String helpers ──────────────────────────────────────────────────────────

function toPascal(str) {
  return str.replace(/(^\w|-\w|_\w)/g, m => m.replace(/[-_]/, '').toUpperCase());
}

function toCamel(str) {
  const p = toPascal(str);
  return p[0].toLowerCase() + p.slice(1);
}

function toKebab(str) {
  return str.replace(/([A-Z])/g, m => `-${m.toLowerCase()}`).replace(/^-/, '').toLowerCase();
}

module.exports = { generateModule };
