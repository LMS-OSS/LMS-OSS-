import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/app/lib/auth/authUtils";
import { createData } from "@/app/lib/db/createData";
import { updateData } from "@/app/lib/db/updateData";
import prisma from "@/lib/prisma";
export async function PUT(
  request: NextRequest,
  { params }: { params: { placement_test_id: string } }
) {
  try {
    const body = await request.json();
    const { name, description, time_limit } = body;

    const user = await authenticateRequest(request);

    if (user instanceof NextResponse) {
      return user;
    }

    await updateData(
      "placementTest",
      { placement_test_id: params.placement_test_id },
      {
        name,
        description,
        timeLimit: Number(time_limit),
      }
    );

    return NextResponse.json({
      status: 200,
      error: false,
      data: "Placement Test updated",
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
