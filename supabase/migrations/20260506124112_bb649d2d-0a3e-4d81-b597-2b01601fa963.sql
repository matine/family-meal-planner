
ALTER TABLE public.ingredients REPLICA IDENTITY FULL;
ALTER TABLE public.recipes REPLICA IDENTITY FULL;
ALTER TABLE public.meal_plan REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_list REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.ingredients;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plan;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_list;
