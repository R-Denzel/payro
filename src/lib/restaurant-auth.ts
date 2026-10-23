import { getSupabase } from "./supabase";
import { redirect } from "@tanstack/react-router";

export type RestaurantAccess = {
  id: string;
  name: string;
  role: "owner" | "manager" | "staff";
  status: string;
};

export async function getRestaurantAccess(): Promise<RestaurantAccess | null> {
  const client = getSupabase();
  if (!client) return null;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const { data, error } = await client
    .from("restaurant_members")
    .select("role, restaurants(id,name,status)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const restaurant = Array.isArray(data.restaurants) ? data.restaurants[0] : data.restaurants;
  return restaurant
    ? { id: restaurant.id, name: restaurant.name, role: data.role, status: restaurant.status }
    : null;
}

export async function requireRestaurant(): Promise<RestaurantAccess> {
  const access = await getRestaurantAccess();
  if (access) return access;
  const client = getSupabase();
  const { data } = (await client?.auth.getSession()) ?? { data: { session: null } };
  if (data.session) await client?.auth.signOut();
  throw redirect({ to: "/restaurant/login" });
}
