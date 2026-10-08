import bcrypt from "bcryptjs";
import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());
  const { getPool } = await import("../server/db");
  const principalPassword = process.env.SEED_PRINCIPAL_PASSWORD;
  const teacherPassword = process.env.SEED_TEACHER_PASSWORD;
  if (!principalPassword || !teacherPassword) {
    throw new Error("Set SEED_PRINCIPAL_PASSWORD and SEED_TEACHER_PASSWORD before seeding.");
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tenant = await client.query<{ id: string }>(
      `INSERT INTO tenants (name, slug) VALUES ('Mobsie Connect', 'mobsie-academy')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    );
    const tenantId = tenant.rows[0].id;
    const principalEmail = process.env.SEED_PRINCIPAL_EMAIL ?? "principal@mobsie.co.za";
    const branches = [
      ['Soshanguve Branch 1', 'soshanguve-1', 'Soshanguve', 'Pretoria', '7347/5 Umkhangele Street, Soshanguve East, 0164', '012 757 1858', 'Eutricia Mokoena'],
      ['Soshanguve Branch 2', 'soshanguve-2', 'Soshanguve', 'Pretoria', 'Soshanguve, Pretoria', '012 757 1858', 'Eutricia Mokoena'],
      ['Mamelodi Branch', 'mamelodi', 'Mamelodi', 'Pretoria', 'Mamelodi East, Pretoria', '012 770 1231', 'Palesa Ramapulana'],
      ['Sky City Branch', 'sky-city', 'Sky City', 'Johannesburg', 'Sky City, Alberton, Johannesburg', '065 737 8254', 'Peggy Modipedi'],
      ['Hebron Branch', 'hebron', 'Hebron', 'Pretoria', 'Hebron, Pretoria', '067 455 2333', 'Semakaleng Laka'],
      ['Soweto Branch', 'soweto', 'Soweto', 'Johannesburg', 'Soweto, Johannesburg', '065 737 8254', ''],
      ['Thembisa Branch', 'thembisa', 'Thembisa', 'Johannesburg', 'Thembisa, Johannesburg', '065 737 8254', ''],
      ['Cosmo City Branch', 'cosmo-city', 'Cosmo City', 'Johannesburg', 'Cosmo City, Randburg', '065 737 8254', ''],
    ] as const;
    const branchIds = new Map<string, string>();
    for (const [name, slug, city, region, address, phone, principalName] of branches) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO branches (
           tenant_id,name,slug,city,region,address,phone,email,principal_name,principal_email,
           principal_phone,learner_count,teacher_count,attendance_rate
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,'info@mobsiekids.co.za',$8,$9,$7,0,0,0)
         ON CONFLICT (tenant_id,slug) DO UPDATE SET
           name=EXCLUDED.name,city=EXCLUDED.city,region=EXCLUDED.region,address=EXCLUDED.address,
           phone=EXCLUDED.phone,principal_name=EXCLUDED.principal_name,principal_email=EXCLUDED.principal_email
         RETURNING id`,
        [tenantId, name, slug, city, region, address, phone, principalName || null, principalEmail],
      );
      branchIds.set(slug, result.rows[0].id);
    }
    const users = [
      {
        email: process.env.SEED_PRINCIPAL_EMAIL ?? "principal@mobsie.co.za",
        name: "Thandi Admin",
        password: principalPassword,
        role: "PRINCIPAL",
        branchId: null,
      },
      {
        email: process.env.SEED_TEACHER_EMAIL ?? "teacher@mobsie.co.za",
        name: "Eutricia Mokoena",
        password: teacherPassword,
        role: "TEACHER",
        branchId: branchIds.get('soshanguve-1')!,
      },
    ];
    const staff = [
      ['hebron', 'Semakaleng Laka', 'Branch Principal & Driver'], ['hebron', 'Ellen Sepeng', 'Kitchen Support & Teacher Assistant'], ['hebron', 'Natasha', 'Guardian Teacher'], ['hebron', 'Tumisanf Ntshabele', 'Mentor – President of NPO'],
      ['soshanguve-1', 'Eutricia Mokoena', 'Branch Principal & Guardian Teacher'], ['soshanguve-1', 'Mmule Mudawe', 'Guardian Teacher'], ['soshanguve-1', 'Constance Mpeki', 'Kitchen Support & Teacher Assistant'], ['soshanguve-1', 'Boledi Maja', 'Teacher Assistant & Driver'], ['soshanguve-1', 'Tebogo Nonyane', 'Guardian Teacher'], ['soshanguve-1', 'Juliet Baloyi', 'Guardian Teacher'],
      ['mamelodi', 'Palesa Ramapulana', 'Branch Principal & Guardian Teacher'], ['mamelodi', 'Johana Pitseng', 'Guardian Teacher'], ['mamelodi', 'Moipoine Pilane', 'Assistant Teacher'], ['mamelodi', 'Pauline Selatile', 'Kitchen Support'],
      ['sky-city', 'Peggy Modipedi', 'Branch Principal'], ['sky-city', 'Thuli Mngomezulu', 'Kitchen Support & Teacher Assistant'], ['sky-city', 'Nonhlanhla Nxumalo', 'Guardian Teacher'], ['sky-city', 'Nkateko Kgosana', 'Teacher Assistant'],
    ] as const;
    for (const [branchSlug, name, title] of staff) {
      const branchId = branchIds.get(branchSlug)!;
      const email = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@mobsiekids.co.za`;
      users.push({ email, name, password: teacherPassword, role: 'TEACHER', branchId });
      await client.query(
        `INSERT INTO team_members (tenant_id,branch_id,name,title,bio,years_experience,image_url,image_public_id,is_principal,contact_email,contact_phone,display_order)
         SELECT $1,$2,$3,$4,$5,0,$6,$7,$8,$9,NULL,0
         WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE tenant_id=$1 AND branch_id=$2 AND name=$3)`,
        [tenantId, branchId, name, title, `${name} is part of the Mobsie Kids ${branchSlug} team.`, `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=008f88&color=ffffff&size=256`, `seed/${branchSlug}/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, title.includes('Principal'), email],
      );
    }
    for (const user of users) {
      await client.query(
        `INSERT INTO users (tenant_id, branch_id, email, name, password_hash, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (tenant_id, email) DO UPDATE SET
           name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role, branch_id = EXCLUDED.branch_id, is_active = true`,
        [
          tenantId,
          user.branchId,
          user.email,
          user.name,
          await bcrypt.hash(user.password, 12),
          user.role,
        ],
      );
    }
    const products = [
      ["Winter Tracksuit", "Uniform", 42000, 86],
      ["School Golf Shirt", "Uniform", 18000, 122],
      ["Mobsie Backpack", "Accessories", 35000, 34],
      ["Stationery Pack — Gr R", "Stationery", 26000, 12],
      ["Water Bottle 500ml", "Accessories", 8500, 210],
      ["Reader Set — Level 1", "Books", 31000, 28],
    ] as const;
    for (const [name, category, priceCents, stock] of products) {
      await client.query(
        `INSERT INTO shop_products (tenant_id,name,category,price_cents,stock,status)
         SELECT $1,$2,$3,$4,$5,CASE WHEN $5=0 THEN 'OUT_OF_STOCK' ELSE 'ACTIVE' END
         WHERE NOT EXISTS (SELECT 1 FROM shop_products WHERE tenant_id=$1 AND name=$2)`,
        [tenantId, name, category, priceCents, stock],
      );
    }
    const seededProduct = await client.query<{ id: string; name: string; price_cents: number }>(
      `SELECT id,name,price_cents FROM shop_products WHERE tenant_id=$1 ORDER BY created_at LIMIT 1`,
      [tenantId],
    );
    if (seededProduct.rows[0]) {
      const order = await client.query<{ id: string }>(
        `INSERT INTO shop_orders (tenant_id,reference,parent_name,branch_id,total_cents,status)
         VALUES ($1,'ORD-SEED-001','Demo Parent',$2,$3,'PROCESSING')
         ON CONFLICT (tenant_id,reference) DO UPDATE SET parent_name=EXCLUDED.parent_name
         RETURNING id`,
        [tenantId, branchIds.get('soshanguve-1')!, seededProduct.rows[0].price_cents],
      );
      await client.query(
        `INSERT INTO shop_order_items (order_id,product_id,product_name,quantity,unit_price_cents)
         SELECT $1,$2,$3,1,$4 WHERE NOT EXISTS
           (SELECT 1 FROM shop_order_items WHERE order_id=$1 AND product_id=$2)`,
        [order.rows[0].id, seededProduct.rows[0].id, seededProduct.rows[0].name, seededProduct.rows[0].price_cents],
      );
    }
    await client.query("COMMIT");
    console.info("Seeded branches, staff roster, principal, teachers and shop catalogue.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
