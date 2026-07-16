"use client";

import { useParams } from "next/navigation";
import ArchiveFolderBrowser from "@/components/archive/ArchiveFolderBrowser";

export default function ArchiveFolderPage() {
  const { id } = useParams<{ id: string }>();
  return <ArchiveFolderBrowser folderId={id} />;
}
