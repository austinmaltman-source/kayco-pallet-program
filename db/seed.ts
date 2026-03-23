import "dotenv/config";

import { db } from "@/db";
import {
  customerProducts,
  customers,
  palletHistory,
  products,
} from "@/db/schema";
import { CUSTOMERS } from "@/lib/customers";
import { productToDbValues } from "@/lib/mappers";

async function seed() {
  for (const customer of CUSTOMERS) {
    await db
      .insert(customers)
      .values({
        id: customer.id,
        name: customer.name,
        contact: customer.contact,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        status: customer.status,
      })
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: customer.name,
          contact: customer.contact,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          status: customer.status,
        },
      });

    for (const product of customer.products) {
      await db
        .insert(products)
        .values(productToDbValues(product))
        .onConflictDoNothing({ target: products.id });

      await db
        .insert(customerProducts)
        .values({
          customerId: customer.id,
          productId: product.id,
        })
        .onConflictDoNothing();
    }

    for (const history of customer.palletHistory) {
      await db
        .insert(palletHistory)
        .values({
          id: history.id,
          customerId: customer.id,
          name: history.name,
          date: new Date(history.date),
          skuCount: history.skuCount,
          status: history.status,
        })
        .onConflictDoNothing({ target: palletHistory.id });
    }
  }
}

seed()
  .then(() => {
    console.log("Seed complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed", error);
    process.exit(1);
  });
