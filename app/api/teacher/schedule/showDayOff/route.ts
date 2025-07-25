import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateRequest } from "@/app/lib/auth/authUtils";

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);

  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const getDayOff = await prisma.teacherLeave.findMany({
      where: {
        teacher_id: user.user_id,
      },
      select: {
        leave_date: true,
      },
    });

    const formattedDayOff = getDayOff.map((dayOff) => {
      return {
        leave_date: dayOff.leave_date.toISOString().split("T")[0],
      };
    });

    return NextResponse.json({
      status: 200,
      error: false,
      data: formattedDayOff,
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
