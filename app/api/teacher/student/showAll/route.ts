import { NextRequest, NextResponse } from "next/server";

import { getData } from "@/app/lib/db/getData";
import { authenticateRequest } from "@/app/lib/auth/authUtils";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import prisma from "@/lib/prisma";
dayjs.extend(utc);

export async function GET(request: NextRequest) {
  const user = await authenticateRequest(request);

  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const getStudent = await getData(
      "user",
      {
        where: {
          role: "STUDENT",
        },
        select: {
          user_id: true,
          username: true,
          no_phone: true,
          count_program: true,
          program_id: true,
          imageUrl: true,
          region: true,
          is_evaluation: true,
          target: true,
          name_group: true,
          type_student: true,
        },
      },
      "findMany"
    );

    return NextResponse.json({ status: 200, error: false, data: getStudent });
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
