import { authenticateRequest } from "@/app/lib/auth/authUtils";
import { NextRequest, NextResponse } from "next/server";
import { evaluateWritingAnswer } from "@/app/lib/utils/geminiHelper";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await authenticateRequest(request);
  if (user instanceof NextResponse) {
    return user;
  }

  try {
    const body = await request.json();
    const { selectedData, placement_test_id, access_id } = body;

    if (!placement_test_id || !access_id || !selectedData) {
      return NextResponse.json({
        status: 400,
        error: true,
        message: "Data tidak lengkap.",
      });
    }

    const [mcCount, tfCount, writingCount] = await prisma.$transaction([
      prisma.multipleChoicePlacementTest.count({
        where: {
          basePlacementTest: {
            placementTestId: placement_test_id,
          },
        },
      }),
      prisma.trueFalseQuestion.count({
        where: {
          trueFalseGroup: {
            basePlacementTest: {
              placementTestId: placement_test_id,
            },
          },
        },
      }),
      prisma.writingPlacementTest.count({
        where: {
          basePlacementTest: {
            placementTestId: placement_test_id,
          },
        },
      }),
    ]);

    const totalQuestionsCount = mcCount + tfCount + writingCount;

    if (totalQuestionsCount === 0) {
      return NextResponse.json({
        status: 400,
        error: true,
        message: "Placement test tidak memiliki soal.",
      });
    }

    const writingFeedback: {
      writing_id: string;
      score: number;
      feedback: string;
    }[] = [];
    const studentAnswers: any[] = [];

    // ✅ **Proses jawaban secara paralel**
    await Promise.all(
      selectedData.map(async (answer: any) => {
        const { id, selectedAnswer } = answer;

        // 🔹 Cek jenis soal (Multiple Choice, True/False, atau Writing)
        const [multipleChoice, trueFalseQuestion, writingQuestion] =
          await prisma.$transaction([
            prisma.multipleChoicePlacementTest.findUnique({
              where: { mc_id: id },
            }),
            prisma.trueFalseQuestion.findUnique({ where: { tf_id: id } }),
            prisma.writingPlacementTest.findUnique({
              where: { writing_id: id },
            }),
          ]);

        let isCorrect = null;
        let score = 0;

        if (multipleChoice) {
          isCorrect = multipleChoice.correctAnswer === selectedAnswer;
          score = isCorrect ? 1 : 0;
          studentAnswers.push({
            student_id: user.user_id,
            placement_test_id,
            mcq_id: id,
            studentAnswer: selectedAnswer,
            isCorrect,
            score,
            submittedAt: new Date(),
          });
        } else if (trueFalseQuestion) {
          isCorrect =
            trueFalseQuestion.correctAnswer.toString() === selectedAnswer;
          score = isCorrect ? 1 : 0;
          studentAnswers.push({
            student_id: user.user_id,
            placement_test_id,
            tf_id: id,
            studentAnswer: selectedAnswer,
            isCorrect,
            score,
            submittedAt: new Date(),
          });
        } else if (writingQuestion) {
          // 🔹 Evaluasi AI dilakukan secara background agar API tetap cepat
          (async () => {
            const { aiScore, aiFeedback } = await evaluateWritingAnswer(
              writingQuestion.question,
              selectedAnswer
            );
            await prisma.studentAnswerPlacementTest.create({
              data: {
                student_id: user.user_id,
                placement_test_id,
                writing_id: id,
                studentAnswer: selectedAnswer,
                score: aiScore,
                writing_feedback: aiFeedback,
                submittedAt: new Date(),
              },
            });

            writingFeedback.push({
              writing_id: id,
              score: aiScore,
              feedback: aiFeedback,
            });
          })();
        }
      })
    );

    // ✅ **Batch insert jawaban siswa**
    if (studentAnswers.length > 0) {
      await prisma.studentAnswerPlacementTest.createMany({
        data: studentAnswers,
      });
    }

    // ✅ **Tandai bahwa siswa telah menyelesaikan test**
    await prisma.accessPlacementTest.update({
      where: { access_placement_test_id: access_id },
      data: { is_completed: true },
    });

    const updatedScores = await prisma.studentAnswerPlacementTest.findMany({
      where: { student_id: user.user_id, placement_test_id: placement_test_id },
      select: { score: true },
    });

    // ✅ **Hitung skor akhir siswa dalam satu query**
    const totalScore = updatedScores.reduce(
      (sum, answer) => sum + (answer.score ?? 0),
      0
    );
    const percentageScore =
      Math.min((totalScore / totalQuestionsCount) * 100, 100) || 0;

    let newLevel = "Beginner";
    // 🔹 Tentukan level baru siswa berdasarkan skor
    if (totalScore >= 46) {
      newLevel = "Advanced";
    } else if (totalScore >= 40) {
      newLevel = "Upper Intermediate";
    } else if (totalScore >= 33) {
      newLevel = "Intermediate";
    } else if (totalScore >= 25) {
      newLevel = "Pre-Intermediate";
    } else if (totalScore >= 16) {
      newLevel = "Elementary";
    }

    // ✅ **Simpan level baru dalam satu transaksi**
    await prisma.$transaction([
      prisma.user.update({
        where: { user_id: user.user_id },
        data: { level: newLevel },
      }),
      prisma.scorePlacementTest.create({
        data: {
          student_id: user.user_id,
          placement_test_id,
          totalScore,
          percentageScore: parseFloat(percentageScore.toFixed(2)),
          level: newLevel,
        },
      }),
    ]);

    const formattedPercentageScore = percentageScore.toFixed(2);


    return NextResponse.json({
      status: 200,
      error: false,
      data: { totalScore, percentageScore: formattedPercentageScore, level: newLevel, writingFeedback },
    });
  } catch (error) {
    console.error("Error accessing database:", error);
    return new NextResponse(
      JSON.stringify({ error: "Internal Server Error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
