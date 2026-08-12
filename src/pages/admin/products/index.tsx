import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import type { Product } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const TYPE_LABEL: Record<string, string> = {
  MEMBERSHIP: "Membership",
  BOOK: "Book",
  DIGITAL: "Digital",
  PHYSICAL: "Physical",
};

type ProductWithCount = Product & { _count: { prices: number } };

interface Props {
  products: ProductWithCount[];
}

const AdminProductsPage: NextPageWithLayout<Props> = ({ products }) => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage membership plans, books, and other products.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark transition-colors"
        >
          + New Product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No products yet.</p>
          <p className="mt-1 text-sm text-slate-400">Create your first product to get started.</p>
          <Link
            href="/admin/products/new"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark"
          >
            + New Product
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Active</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Prices</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sort</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-400">{product.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
                      {TYPE_LABEL[product.type] ?? product.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${product.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                      {product.active ? "✓" : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{product._count.prices}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{product.sortOrder}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-sm font-medium text-navy no-underline hover:text-navy-dark"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

AdminProductsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const products = await db.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { prices: { where: { active: true } } } } },
  });

  return { props: { products: JSON.parse(JSON.stringify(products)) } };
};

export default AdminProductsPage;
