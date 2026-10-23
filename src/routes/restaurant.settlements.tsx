import { createFileRoute } from "@tanstack/react-router";
import { RestaurantSection } from "@/components/payro/RestaurantSection";
import { requireRestaurant } from "@/lib/restaurant-auth";
export const Route = createFileRoute("/restaurant/settlements")({
  ssr: false,
  beforeLoad: requireRestaurant,
  component: () => <RestaurantSection kind="settlements" />,
});
