import { crudService } from "@/app/lib/services/crudServices";
import { fetcher } from "@/app/lib/utils/fetcher";
import { Section } from "@prisma/client";
import { raw } from "@prisma/client/runtime/library";
import { notification } from "antd";
import { useForm } from "antd/es/form/Form";
import jsPDF from "jspdf";
import { useState, useEffect } from "react";
import useSWR from "swr";

interface Certificate {
  certificate_id: string;
  no_certificate: string;
  student_id: string | null;
  user_group_id: string | null;
  is_complated_meeting: boolean;
  is_complated_testimoni: boolean;
  overall?: string | null;
  is_download: boolean;
  student_name: string;
  program_name: string;
  type_student: "INDIVIDUAL" | "GROUP";
  group_members?: any[];
  certificateData?: CertificateData[];
}

interface CertificateResponse {
  data: Certificate;
}


interface CertificateData {
  no_certificate: string;
  group_members: any[];
}

interface EvaluationResponse {
  data: Section[];
}

export const useCertificateViewModel = () => {
  const {
    data: certificateData,
    isLoading,
    mutate: mutateCertificateData,
  } = useSWR<CertificateResponse>(`/api/student/certificate/show`, fetcher);

  const {
    data: evaluationSWR,
    isLoading: evaluationLoading,
    mutate: mutateEvaluationData,
  } = useSWR<EvaluationResponse>(
    `/api/student/certificate/showEvaluation`,
    fetcher
  );

  const defaultCertificate: Certificate = {
    certificate_id: "",
    no_certificate: "-",
    student_id: null,
    user_group_id: null,
    is_complated_meeting: false,
    is_complated_testimoni: false,
    is_download: false,
    student_name: "-",
    program_name: "-",
    type_student: "INDIVIDUAL",
    group_members: [],
  };

  const [selectedGroupMember, setSelectedGroupMember] = useState<any | null>(
    null
  );
  const [isModalTestimoniVisible, setIsModalTestimoniVisible] = useState(false);
  const [form] = useForm();
  const [loading, setLoading] = useState(false);
  const [certificateFrontPreview, setCertificateFrontPreview] = useState<
    string | null
  >(null);
  const [certificateBackPreview, setCertificateBackPreview] = useState<
    string | null
  >(null);

  const rawCertificate = certificateData?.data ?? null;


  const certificate: Certificate =
    selectedGroupMember?.certificate ??
    (rawCertificate
      ? {
          ...defaultCertificate,
          ...rawCertificate,
        }
      : defaultCertificate);


    const evaluationData = selectedGroupMember?.sections
      ? { data: selectedGroupMember.sections }
      : evaluationSWR?.data
      ? { data: evaluationSWR.data }
      : { data: [] }; 

  const groupMembers = certificateData?.data?.group_members || [];

  const handleSelectGroupMember = (member: any) => {
    setSelectedGroupMember(member);
    setCertificateFrontPreview(null);
    setCertificateBackPreview(null);
  };

  console.log(certificate);

  // const no_certificate_individual = certificate?.

  const generateCertificatePreview = async (): Promise<void> => {
    if (certificate && evaluationData) {
      const studentNameToUse =
        certificate?.type_student === "GROUP" && selectedGroupMember
          ? selectedGroupMember.username
          : certificate?.student_name;
      const no_certificate =
        certificate?.type_student === "GROUP" && selectedGroupMember
          ? selectedGroupMember.certificate?.no_certificate
          : certificate?.certificateData?.[0]?.no_certificate;

      const doc = new jsPDF("landscape", "px", "a4");
      const canvas: HTMLCanvasElement = document.createElement("canvas");
      const context = canvas.getContext("2d");

      const imgFront = new Image();
      imgFront.src = "/assets/images/certificate_front.png";

      await new Promise((resolve) => {
        imgFront.onload = () => resolve(null);
      });

      canvas.width = imgFront.width;
      canvas.height = imgFront.height;

      if (context) {
        context.drawImage(imgFront, 0, 0);
        context.fillStyle = "black";
        context.font = "bold 150px Montserrat";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(studentNameToUse, canvas.width / 2, 1300);
        context.font = "italic 100px Montserrat";
        context.fillText(
          `NO: ${no_certificate ?? "-"}`,
          canvas.width / 2,
          1800
        );
      }

      setCertificateFrontPreview(canvas.toDataURL("image/png"));

      const imgBack = new Image();
      imgBack.src = "/assets/images/certificate_back.png";

      await new Promise((resolve) => {
        imgBack.onload = () => resolve(null);
      });

      canvas.width = imgBack.width;
      canvas.height = imgBack.height;

      if (context) {
        context.drawImage(imgBack, 0, 0);

        let startY = 1020;
        const sectionX = 570;
        const levelX = 1050;
        const commentX = 1350;
        const maxWidthComment = 1300;
        const lineHeight = 50;
        const rowHeight = 250;

        context.fillStyle = "black";
        context.font = "bold 60px Montserrat";
        context.textAlign = "left";

        const wrapText = (
          ctx: CanvasRenderingContext2D,
          text: string,
          x: number,
          y: number,
          maxWidth: number,
          lineHeight: number
        ): number => {
          const words = text.split(" ");
          let line = "";
          let yOffset = 0;

          words.forEach((word, index) => {
            const testLine = line + (line ? " " : "") + word;
            const testWidth = ctx.measureText(testLine).width;

            if (testWidth > maxWidth && line !== "") {
              ctx.fillText(line, x, y + yOffset);
              line = word;
              yOffset += lineHeight;
            } else {
              line = testLine;
            }

            if (index === words.length - 1) {
              ctx.fillText(line, x, y + yOffset);
            }
          });

          return yOffset;
        };

        (evaluationData?.data || []).forEach((section: Section) => {
          const { section_type, level, comment } = section;
          let commentStartY = startY;
          context.font = "bold 60px Montserrat";
          context.fillText(section_type, sectionX, startY);
          context.fillText(level, levelX, startY);
          context.font = "bold 40px Montserrat";
          const commentHeightUsed = wrapText(
            context,
            comment,
            commentX,
            commentStartY,
            maxWidthComment,
            lineHeight
          );
          startY += Math.max(rowHeight, commentHeightUsed + lineHeight);
        });

        setCertificateBackPreview(canvas.toDataURL("image/png"));
      }
    }
  };

  const handleOpenModalTestimoni = () => {
    setIsModalTestimoniVisible(true);
  };

  const handleCancelModalTestimoni = () => {
    setIsModalTestimoniVisible(false);
    form.resetFields();
  };

  const handleSubmit = async (values: any) => {
    const payload = {
      lesson_satisfaction: values.lesson_satisfaction || 0,
      teaching_method_effectiveness: values.teaching_method_effectiveness || 0,
      exercise_and_assignment_relevance:
        values.exercise_and_assignment_relevance || 0,
      material_relevance: values.material_relevance || 0,
      teacher_identity: values.teacher_identity || "",
      teaching_delivery: values.teaching_delivery || 0,
      teacher_attention: values.teacher_attention || 0,
      teacher_ethics: values.teacher_ethics || 0,
      teacher_motivation: values.teacher_motivation || 0,
      class_experience: values.class_experience || "",
      favorite_part: values.favorite_part || "",
      improvement_suggestions: values.improvement_suggestions || "",
    };

    try {
      setLoading(true);
      await crudService.post("/api/student/testimoni/create", payload);
      notification.success({
        message: "Berhasil",
        description: "Berhasil menambahkan testimoni",
      });
      mutateCertificateData();
      mutateEvaluationData();
      handleCancelModalTestimoni();
      setLoading(false);
    } catch (error) {
      console.error("Error submitting testimoni:", error);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    certificateData,
    evaluationData,
    isLoading,
    evaluationLoading,
    certificateBackPreview,
    certificateFrontPreview,
    generateCertificatePreview,
    certificate,
    handleCancelModalTestimoni,
    handleOpenModalTestimoni,
    isModalTestimoniVisible,
    form,
    handleSubmit,
    groupMembers,
    loading,
    handleSelectGroupMember,
    selectedGroupMember,
    setSelectedGroupMember,
  };
};
