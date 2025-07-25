import { NextRequest, NextResponse } from "next/server";

import { authenticateRequest } from "@/app/lib/auth/authUtils";
import prisma from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { student_id: string } }
) {
  const user = await authenticateRequest(request);

  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const dataRenewel = await prisma.userProgramRenewal.findMany({
      where: {
        user_id: params.student_id,
      },
    });

    return NextResponse.json({
      status: 200,
      error: false,
      data: dataRenewel,
    });
  } catch (error) {
    console.error("Error accessing database:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } finally {
    await prisma.$disconnect();
  }
}
