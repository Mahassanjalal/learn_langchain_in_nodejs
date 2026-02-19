// ---------------------------------------------------------------------------
// Skill type — each skill is a self-contained unit of specialized instructions
// ---------------------------------------------------------------------------
export interface Skill {
  /** Unique identifier used to load the skill */
  name: string;
  /** 1-2 sentence description shown in the system prompt upfront */
  description: string;
  /** Full schema + business logic loaded on-demand via the load_skill tool */
  content: string;
}

// ---------------------------------------------------------------------------
// Skill registry
// Add new skills here — the agent discovers them automatically via the system
// prompt and loads their content only when relevant.
// ---------------------------------------------------------------------------
export const SKILLS: Skill[] = [
  {
    name: "sales_analytics",
    description:
      "Database schema and business logic for sales data analysis, " +
      "including customers, orders, order items, and revenue calculations.",
    content: `
# Sales Analytics Schema

## Tables

### customers
- customer_id   (PRIMARY KEY)
- name
- email
- signup_date
- status          (active | inactive)
- customer_tier   (bronze | silver | gold | platinum)

### orders
- order_id        (PRIMARY KEY)
- customer_id     (FOREIGN KEY → customers)
- order_date
- status          (pending | completed | cancelled | refunded)
- total_amount    (already includes discounts)
- sales_region    (north | south | east | west)

### order_items
- item_id         (PRIMARY KEY)
- order_id        (FOREIGN KEY → orders)
- product_id
- quantity
- unit_price
- discount_percent

## Business Logic

**Active customers**
  status = 'active' AND signup_date <= CURRENT_DATE - INTERVAL '90 days'

**Revenue calculation**
  Count only orders with status = 'completed'.
  Use total_amount from the orders table (discounts already applied).

**Customer Lifetime Value (CLV)**
  SUM of total_amount for all completed orders per customer.

**High-value orders**
  orders.total_amount > 1000

## Example Query

-- Top 10 customers by revenue last quarter
SELECT
    c.customer_id,
    c.name,
    c.customer_tier,
    SUM(o.total_amount) AS total_revenue
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status = 'completed'
  AND o.order_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY c.customer_id, c.name, c.customer_tier
ORDER BY total_revenue DESC
LIMIT 10;
    `.trim(),
  },

  {
    name: "inventory_management",
    description:
      "Database schema and business logic for inventory tracking, " +
      "including products, warehouses, stock levels, and stock movements.",
    content: `
# Inventory Management Schema

## Tables

### products
- product_id    (PRIMARY KEY)
- product_name
- sku
- category
- unit_cost
- reorder_point (minimum stock before reordering)
- discontinued  (BOOLEAN)

### warehouses
- warehouse_id  (PRIMARY KEY)
- warehouse_name
- location
- capacity

### inventory
- inventory_id  (PRIMARY KEY)
- product_id    (FOREIGN KEY → products)
- warehouse_id  (FOREIGN KEY → warehouses)
- quantity_on_hand
- last_updated

### stock_movements
- movement_id     (PRIMARY KEY)
- product_id      (FOREIGN KEY → products)
- warehouse_id    (FOREIGN KEY → warehouses)
- movement_type   (inbound | outbound | transfer | adjustment)
- quantity        (positive for inbound, negative for outbound)
- movement_date
- reference_number

## Business Logic

**Available stock**
  quantity_on_hand > 0

**Products needing reorder**
  SUM(quantity_on_hand) across all warehouses ≤ products.reorder_point

**Active products only**
  Exclude discontinued = true unless the query explicitly targets discontinued items.

**Stock valuation**
  quantity_on_hand × unit_cost per product per warehouse.

## Example Query

-- Products below reorder point across all warehouses
SELECT
    p.product_id,
    p.product_name,
    p.reorder_point,
    SUM(i.quantity_on_hand)                          AS total_stock,
    p.unit_cost,
    (p.reorder_point - SUM(i.quantity_on_hand))      AS units_to_reorder
FROM products p
JOIN inventory i ON p.product_id = i.product_id
WHERE p.discontinued = false
GROUP BY p.product_id, p.product_name, p.reorder_point, p.unit_cost
HAVING SUM(i.quantity_on_hand) <= p.reorder_point
ORDER BY units_to_reorder DESC;
    `.trim(),
  },

  {
    name: "hr_analytics",
    description:
      "Database schema and business logic for HR data analysis, " +
      "including employees, departments, salaries, and performance reviews.",
    content: `
# HR Analytics Schema

## Tables

### employees
- employee_id     (PRIMARY KEY)
- first_name
- last_name
- email
- hire_date
- department_id   (FOREIGN KEY → departments)
- manager_id      (FOREIGN KEY → employees, self-referential)
- employment_status (active | terminated | on_leave)

### departments
- department_id   (PRIMARY KEY)
- department_name
- cost_center
- location

### salaries
- salary_id       (PRIMARY KEY)
- employee_id     (FOREIGN KEY → employees)
- base_salary
- effective_date
- end_date        (NULL = current record)

### performance_reviews
- review_id       (PRIMARY KEY)
- employee_id     (FOREIGN KEY → employees)
- review_date
- rating          (1–5 scale)
- reviewer_id     (FOREIGN KEY → employees)

## Business Logic

**Current salary**
  WHERE end_date IS NULL (most recent open-ended record per employee).

**Active employees**
  employment_status = 'active'

**Tenure**
  CURRENT_DATE - hire_date expressed in years.

**Headcount**
  COUNT of active employees per department.

**Average rating**
  AVG(rating) over the last 12 months per employee.

## Example Query

-- Department headcount and average salary
SELECT
    d.department_name,
    COUNT(e.employee_id)  AS headcount,
    AVG(s.base_salary)    AS avg_salary
FROM departments d
JOIN employees  e ON d.department_id = e.department_id
JOIN salaries   s ON e.employee_id   = s.employee_id
                  AND s.end_date IS NULL
WHERE e.employment_status = 'active'
GROUP BY d.department_name
ORDER BY headcount DESC;
    `.trim(),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the skills section injected into the system prompt */
export function buildSkillsPrompt(): string {
  const lines = SKILLS.map(
    (s) => `  - **${s.name}**: ${s.description}`
  ).join("\n");
  return (
    `## Available Skills\n\n` +
    `Use the \`load_skill\` tool to get the full schema and business logic ` +
    `for any of the following skills before writing queries:\n\n${lines}\n\n` +
    `Always load the relevant skill before writing a SQL query.`
  );
}
