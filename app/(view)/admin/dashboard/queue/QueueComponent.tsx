import { Divider, Tag, Badge, Card, Skeleton, Grid, Typography } from "antd";
import { useEffect, useState } from "react";
import { useQueueViewModel } from "./useQueueViewModel";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { secondaryColor } from "@/app/lib/utils/colors";
dayjs.extend(utc);

const { useBreakpoint } = Grid;

export default function QueueComponent() {
  const { queueData, queueError, isLoadingQueue } = useQueueViewModel();
  const [events, setEvents] = useState([]);
  const screens = useBreakpoint();

  useEffect(() => {
    if (queueData?.data) {
      const formattedEvents = queueData.data.map((item: any) => ({
        id: item.meeting_id,
        title: `${item.teacher.username} - ${item.student.username}`,
        start: dayjs.utc(item.dateTime).format("YYYY-MM-DD HH:mm"),
        allDay: false,
        backgroundColor: item.absent === true ? "#ff4d4f" : "#52c41a",
        time: dayjs.utc(item.dateTime).format("HH:mm"),
        teacher: item.teacher.username,
        student: item.student.username,
      }));
      setEvents(formattedEvents);
    }
  }, [queueData]);

  const renderEventContent = (eventInfo: any) => {
    const { title, time, teacher, student } = eventInfo.event.extendedProps;

    return (
      <div
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: "10px",
          padding: "10px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          minHeight: "60px",
          width: "100%",
        }}
      >
        {/* Waktu di pojok atas dalam bentuk bubble */}
        <div
          style={{
            position: "absolute",
            top: "-10px",
            left: "10px",
            background: "#1677ff",
            color: "#fff",
            fontWeight: "bold",
            padding: "2px 10px",
            borderRadius: "8px",
            fontSize: "12px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          {time}
        </div>

        {/* Konten utama */}
        <div
          style={{
            marginTop: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            textAlign: "center",
          }}
        >
          <Typography.Text
            strong
            style={{ alignItems: "center", color: "#c08c3e", fontSize: "14px" }}
          >
            {teacher}
          </Typography.Text>
          <Typography.Text
            strong
            style={{ color: "#1677ff", fontSize: "14px" }}
          >
            {student}
          </Typography.Text>
        </div>
      </div>
    );
  };


  return (
    <div
      style={{
        padding: screens.xs ? "20px 12px" : "40px 24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: screens.xs ? "wrap" : "nowrap",
        }}
      >
        <h1
          style={{
            fontSize: screens.xs ? "22px" : "28px",
            fontWeight: "600",
            marginBottom: "10px",
          }}
        >
          Jadwal Pertemuan
        </h1>
      </div>
      <Divider style={{ margin: screens.xs ? "10px 0" : "20px 0" }} />
      <Card
        style={{
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          padding: screens.xs ? "10px" : "20px",
        }}
      >
        {isLoadingQueue ? (
          <Skeleton active paragraph={{ rows: screens.xs ? 3 : 6 }} />
        ) : (
          <div
            style={{
              overflowX: "auto",
              overflowY: "hidden",
              minWidth: "100%",
              touchAction: "pan-x", // Ensures only horizontal scroll is active
              WebkitOverflowScrolling: "touch", // Helps smooth scrolling on iOS
              display: "flex",
            }}
          >
            {/* Adjust the calendar width for horizontal scrolling */}
            <div style={{ minWidth: "1200px", pointerEvents: "auto" }}>
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView={screens.xs ? "timeGridDay" : "dayGridMonth"}
                events={events}
                locale={"id"}
                eventContent={renderEventContent}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
