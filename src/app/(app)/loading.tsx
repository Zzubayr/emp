import Loader from "@/components/kokonutui/loader";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader size="sm" subtitle="Just a moment" title="Loading" />
    </div>
  );
}
