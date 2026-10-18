export type Profile = {
  id: string
  display_name: string
  role: 'team' | 'teacher'
  team_id: string | null
}
