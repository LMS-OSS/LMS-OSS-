import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/app/lib/auth/authUtils";
import prisma from "@/lib/prisma";
import {
  formatPhoneNumber,
  sendWhatsAppMessage,
} from "@/app/lib/utils/notificationHelper";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

export async function PATCH(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (user instanceof NextResponse) return user;

  const apiKey = process.env.API_KEY_WATZAP!;
  const numberKey = process.env.NUMBER_KEY_WATZAP!;

  try {
    const { meeting_id, activity, student_id } = await request.json();

    const meetingData = await prisma.meeting.findUnique({
      where: { meeting_id },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    const progressData = await prisma.progressMeeting.findMany({
      where: { meeting_id },
    });

    if (!meetingData) throw new Error("Meeting tidak ditemukan");

    const now = dayjs().add(8, "hours").utc();
    const startTime = dayjs(meetingData.startTime).utc();

    const timeDifferenceMinutes = now.diff(startTime, "minute");
    const timeDifferenceDays = now.diff(startTime, "day");

    // if (timeDifferenceMinutes < 40) {
    //   return NextResponse.json({
    //     status: 403,
    //     error: true,
    //     message:
    //       "Anda hanya bisa mengupdate absensi setelah 40 menit dari waktu mulai.",
    //   });
    // }

    if (!now.isAfter(startTime)) {
      return NextResponse.json({
        status: 403,
        error: true,
        message: "Anda tidak bisa melakukan absensi sebelum meeting dimulai.",
      });
    }

    if (timeDifferenceDays > 1) {
      return NextResponse.json({
        status: 403,
        error: true,
        message:
          "Absensi hanya bisa dilakukan hingga 1 hari setelah meeting dimulai.",
      });
    }

    const studentData = await prisma.user.findUnique({
      where: { user_id: student_id },
      select: {
        username: true,
        no_phone: true,
        consultant_id: true,
        program_id: true,
        count_program: true,
      },
    });

    const teacherData = await prisma.user.findUnique({
      where: { user_id: user.user_id },
      select: {
        username: true,
        count_program: true,
        no_phone: true,
      },
    });

    if (!studentData) throw new Error("Siswa tidak ditemukan");

    const programData = await prisma.program.findUnique({
      where: { program_id: studentData.program_id ?? "" },
      select: { name: true, duration: true, count_program: true },
    });

    if (!programData) throw new Error("Program tidak ditemukan");

    let updatedCountProgramStudent = (studentData.count_program ?? 0) + 1;
    let updatedCountProgramTeacher = (teacherData?.count_program ?? 0) + 1;

    if (activity) {


      await prisma.meeting.update({
        where: { meeting_id },
        data: {
          is_started: true,
          absent:true,
          status: "PROGRESS",
          started_time: dayjs().toDate(),
        },
      });

      // await Promise.all([
      //   prisma.user.update({
      //     where: { user_id: student_id },
      //     data: { count_program: updatedCountProgramStudent },
      //   }),
      //   prisma.user.update({
      //     where: { user_id: user.user_id },
      //     data: { count_program: updatedCountProgramTeacher },
      //   }),
      // ]);

      const formattedStudentPhone = formatPhoneNumber(
        studentData.no_phone ?? ""
      );
      await sendWhatsAppMessage(
        apiKey,
        numberKey,
        formattedStudentPhone,
        `📢 *Absensi Diterima!* \n\n🎓 *Siswa:* ${studentData.username}\n📚 *Program:* ${programData.name}\n✅ *Status:* Hadir\n\nTerus semangat belajar! 💪\n\n📊 *Progres Anda:* Anda telah menyelesaikan *${updatedCountProgramStudent}* sesi dari program ini. Tetap semangat! 🚀`
      );
    } else {

      const progress = await prisma.progressMeeting.findFirst({
        where: {
          meeting_id,
        },
        select: {
          progress_student: true,
          abilityScale: true,
          studentPerformance: true,
        },
      });

      if (!progress) {
        return NextResponse.json(
          {
            status: 422,
            error: true,
            message:
              "Silakan isi progress student terlebih dahulu sebelum absen.",
          },
          { status: 422 }
        );
      }

      const incomplete =
        !progress.progress_student ||
        !progress.abilityScale ||
        !progress.studentPerformance;
      if (incomplete) {
        return NextResponse.json(
          {
            status: 422,
            error: true,
            message:
              "Silakan isi progress student terlebih dahulu sebelum absen.",
          },
          { status: 422 }
        );
      }

      await prisma.meeting.update({
        where: { meeting_id },
        data: {
          is_started: false,
          status: "FINISHED",
          finished_time: dayjs().toDate(), // gunakan dayjs now
        },
      });

      // await Promise.all([
      //   prisma.user.update({
      //     where: { user_id: student_id },
      //     data: { count_program: updatedCountProgramStudent },
      //   }),
      //   prisma.user.update({
      //     where: { user_id: user.user_id },
      //     data: { count_program: updatedCountProgramTeacher },
      //   }),
      // ]);

      // await prisma.meeting.update({
      //   where: {
      //     meeting_id: meeting_id,
      //   },
      //   data: {
      //     is_cancelled: true,
      //   },
      // });
    }

    const sessionThresholds =
      programData.duration === 90 ? [10, 20, 25] : [10, 15];

    if (sessionThresholds.includes(updatedCountProgramStudent)) {
      const consultant = await prisma.consultant.findUnique({
        where: { consultant_id: studentData.consultant_id ?? "" },
        select: { name: true, no_phone: true },
      });

      if (consultant) {
        const formattedConsultantPhone = formatPhoneNumber(consultant.no_phone);
        await sendWhatsAppMessage(
          apiKey,
          numberKey,
          formattedConsultantPhone,
          `👋 *Hallo Konsultan ${consultant.name},*\n\n📢 *Notifikasi Konsultasi!*\n\n🎓 *Siswa:* ${studentData.username}\n📚 *Program:* ${programData.name}\n✅ *Sesi Selesai:* ${updatedCountProgramStudent} sesi\n\nSilakan lakukan konsultasi dengan siswa tersebut. Terima kasih! 🙌`
        );
      }
    }

    const completionThreshold = programData.duration === 90 ? 30 : 20;

    if (updatedCountProgramStudent === completionThreshold) {
      await prisma.user.update({
        where: { user_id: student_id },
        data: { is_completed: true, is_active: false },
      });

      await sendWhatsAppMessage(
        apiKey,
        numberKey,
        formatPhoneNumber(studentData.no_phone ?? ""),
        `🎉 *Selamat ${studentData.username}!* \n\nAnda telah menyelesaikan *${programData.name}* dengan total ${updatedCountProgramStudent} sesi. Anda dapat mengunduh sertifikat pada sistem \n👏 Terima kasih telah menyelesaikan program ini!`
      );

      await sendWhatsAppMessage(
        apiKey,
        numberKey,
        formatPhoneNumber(teacherData?.no_phone ?? ""),
        `📢 *Pengingat Penting!* 📢\n\n` +
          `Siswa atas nama *${studentData.username}* telah *menyelesaikan* program *${programData.name}*.\n\n` +
          `🎓 *Harap segera memberikan nilai pada sertifikat mereka* agar dapat diterbitkan.\n\n` +
          `Terima kasih atas dedikasi Anda dalam membimbing siswa! 🙌`
      );
    }

    return NextResponse.json({ status: 200, error: false, data: "Success" });
  } catch (error) {
    console.error("Error updating absent status:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
