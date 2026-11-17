import { ListPageSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return <ListPageSkeleton label="Loading people" actions={3} />;
}
