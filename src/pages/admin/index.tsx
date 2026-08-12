import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }
  return { redirect: { destination: "/admin/products", permanent: false } };
};

export default function AdminIndex() {
  return null;
}
