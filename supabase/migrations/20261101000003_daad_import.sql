-- Import open/upcoming programmes (and their universities) from DAAD during the deadline sync.

alter table public.programs
  add column origin text not null default 'manual' check (origin in ('manual', 'daad'));
alter table public.universities
  add column origin text not null default 'manual' check (origin in ('manual', 'daad')),
  add column daad_name text unique;

alter table public.program_sources drop constraint program_sources_matched_by_check;
alter table public.program_sources
  add constraint program_sources_matched_by_check check (matched_by in ('manual', 'auto', 'import'));

alter table public.deadline_sync_runs
  add column imported int not null default 0,
  add column universities_created int not null default 0,
  add column import_skipped int not null default 0;

-- City coordinates for new universities (OpenStreetMap Nominatim, looked up once; the sync
-- adds cities it has not seen before).
create table public.geo_cities (
  city text primary key,
  state text not null,
  lat numeric(9, 6) not null check (lat between 47 and 56),
  lng numeric(9, 6) not null check (lng between 5 and 16)
);
alter table public.geo_cities enable row level security;
create policy "admin read" on public.geo_cities for select to authenticated
  using ((select public.is_admin()));

insert into public.geo_cities (city, state, lat, lng) values
  ('Aachen', 'North Rhine-Westphalia', 50.776351, 6.083862),
  ('Aalen', 'Baden-Württemberg', 48.837561, 10.092959),
  ('Albstadt', 'Baden-Württemberg', 48.233048, 8.999148),
  ('Amberg', 'Bavaria', 48.061103, 10.681032),
  ('Ansbach', 'Bavaria', 49.302861, 10.572229),
  ('Aschaffenburg', 'Bavaria', 49.973813, 9.144666),
  ('Augsburg', 'Bavaria', 48.369034, 10.897952),
  ('Bad Homburg vor der Höhe', 'Hesse', 50.22838, 8.613013),
  ('Bamberg', 'Bavaria', 49.891604, 10.886848),
  ('Bayreuth', 'Bavaria', 49.944634, 11.574354),
  ('Berlin', 'Berlin', 52.517389, 13.395131),
  ('Bernburg / Saale', 'Saxony-Anhalt', 51.793966, 11.737385),
  ('Bielefeld', 'North Rhine-Westphalia', 52.019101, 8.531007),
  ('Bingen am Rhein', 'Rhineland-Palatinate', 49.967546, 7.8944),
  ('Bochum', 'North Rhine-Westphalia', 51.481811, 7.219664),
  ('Bonn', 'North Rhine-Westphalia', 50.735262, 7.102463),
  ('Braunschweig', 'Lower Saxony', 52.264658, 10.523607),
  ('Bremen', 'Bremen', 53.07582, 8.807165),
  ('Bremerhaven', 'Bremen', 53.550539, 8.585195),
  ('Burghausen', 'Bavaria', 48.158864, 12.832942),
  ('Cham', 'Bavaria', 49.217819, 12.666383),
  ('Chemnitz', 'Saxony', 50.832353, 12.918914),
  ('Coburg', 'Bavaria', 50.258223, 10.964561),
  ('Cottbus', 'Brandenburg', 51.756745, 14.335731),
  ('Darmstadt', 'Hesse', 49.872775, 8.651177),
  ('Deggendorf', 'Bavaria', 48.833354, 12.96205),
  ('Dessau-Roßlau', 'Saxony-Anhalt', 51.862087, 12.240545),
  ('Detmold', 'North Rhine-Westphalia', 51.936284, 8.879153),
  ('Dieburg', 'Hesse', 49.89818, 8.839622),
  ('Dortmund', 'North Rhine-Westphalia', 51.514227, 7.465279),
  ('Dresden', 'Saxony', 51.049329, 13.738144),
  ('Duisburg', 'North Rhine-Westphalia', 51.434999, 6.759562),
  ('Düsseldorf', 'North Rhine-Westphalia', 51.225402, 6.776314),
  ('Eberswalde', 'Brandenburg', 52.835081, 13.799654),
  ('Eichstätt', 'Bavaria', 48.886333, 11.19894),
  ('Elsfleth', 'Lower Saxony', 53.235703, 8.457104),
  ('Eltville am Rhein', 'Hesse', 50.022005, 8.104415),
  ('Emden', 'Lower Saxony', 53.367054, 7.20583),
  ('Erfurt', 'Thuringia', 50.977797, 11.028736),
  ('Erlangen', 'Bavaria', 49.597747, 11.003737),
  ('Essen', 'North Rhine-Westphalia', 51.458224, 7.015817),
  ('Esslingen am Neckar', 'Baden-Württemberg', 48.742758, 9.307168),
  ('Feuchtwangen', 'Bavaria', 49.16786, 10.331327),
  ('Flensburg', 'Schleswig-Holstein', 54.783302, 9.433326),
  ('Frankfurt (Oder)', 'Brandenburg', 52.341227, 14.549452),
  ('Frankfurt am Main', 'Hesse', 50.110644, 8.682092),
  ('Freiberg', 'Saxony', 50.916942, 13.342889),
  ('Freiburg im Breisgau', 'Baden-Württemberg', 47.99609, 7.8494),
  ('Freising', 'Bavaria', 48.400827, 11.743956),
  ('Friedberg (Hessen)', 'Hesse', 50.328272, 8.747636),
  ('Friedrichshafen', 'Baden-Württemberg', 47.650028, 9.480086),
  ('Fulda', 'Hesse', 50.551466, 9.676216),
  ('Furtwangen im Schwarzwald', 'Baden-Württemberg', 48.05122, 8.207378),
  ('Garbsen', 'Lower Saxony', 52.427661, 9.60051),
  ('Garching b. München', 'Bavaria', 48.251388, 11.650966),
  ('Geisenheim', 'Hesse', 50.039221, 7.941454),
  ('Gengenbach', 'Baden-Württemberg', 48.403543, 8.015306),
  ('Germersheim', 'Rhineland-Palatinate', 49.222275, 8.36659),
  ('Gießen', 'Hesse', 50.586207, 8.674231),
  ('Greifswald', 'Mecklenburg-Vorpommern', 54.095791, 13.381524),
  ('Gummersbach', 'North Rhine-Westphalia', 51.027766, 7.563054),
  ('Görlitz', 'Saxony', 51.156318, 14.991018),
  ('Göttingen', 'Lower Saxony', 51.532833, 9.935181),
  ('Gütersloh', 'North Rhine-Westphalia', 51.916662, 8.404328),
  ('Halle (Saale)', 'Saxony-Anhalt', 51.482435, 11.971298),
  ('Hamburg', 'Hamburg', 53.550172, 10.001316),
  ('Hannover', 'Lower Saxony', 52.374478, 9.738553),
  ('Heide', 'Schleswig-Holstein', 54.194885, 9.092825),
  ('Heidelberg', 'Baden-Württemberg', 49.409358, 8.694724),
  ('Heilbronn', 'Baden-Württemberg', 49.142291, 9.218655),
  ('Heiligenhaus', 'North Rhine-Westphalia', 51.32658, 6.97104),
  ('Hildesheim', 'Lower Saxony', 52.152719, 9.951808),
  ('Hof', 'Bavaria', 50.318751, 11.916299),
  ('Höxter', 'North Rhine-Westphalia', 51.79389, 9.348855),
  ('Idstein', 'Hesse', 50.2147, 8.2902),
  ('Ilmenau', 'Thuringia', 50.686769, 10.914238),
  ('Ingolstadt', 'Bavaria', 48.763016, 11.42504),
  ('Jena', 'Thuringia', 50.928172, 11.587936),
  ('Kaiserslautern', 'Rhineland-Palatinate', 49.443217, 7.768995),
  ('Kamp-Lintfort', 'North Rhine-Westphalia', 51.501798, 6.547923),
  ('Karlsruhe', 'Baden-Württemberg', 49.00687, 8.40342),
  ('Kassel', 'Hesse', 51.315783, 9.497848),
  ('Kemnath', 'Bavaria', 49.858116, 11.935515),
  ('Kempten (Allgäu)', 'Bavaria', 47.726706, 10.316883),
  ('Kiel', 'Schleswig-Holstein', 54.322708, 10.135555),
  ('Kleve', 'North Rhine-Westphalia', 51.789557, 6.137601),
  ('Koblenz', 'Rhineland-Palatinate', 50.353328, 7.594395),
  ('Konstanz', 'Baden-Württemberg', 47.659216, 9.175072),
  ('Kronach', 'Bavaria', 50.248413, 11.313206),
  ('Kulmbach', 'Bavaria', 50.107125, 11.458181),
  ('Köln', 'North Rhine-Westphalia', 50.938361, 6.959974),
  ('Köthen / Anhalt', 'Saxony-Anhalt', 51.751033, 11.973698),
  ('Künzelsau', 'Baden-Württemberg', 49.280377, 9.690151),
  ('Landau in der Pfalz', 'Rhineland-Palatinate', 49.198282, 8.112344),
  ('Landshut', 'Bavaria', 48.536217, 12.151655),
  ('Leer (Ostfriesland)', 'Lower Saxony', 53.233217, 7.456755),
  ('Leipzig', 'Saxony', 51.340632, 12.374733),
  ('Lemgo', 'North Rhine-Westphalia', 52.028067, 8.901289),
  ('Lippstadt', 'North Rhine-Westphalia', 51.674707, 8.347194),
  ('Ludwigshafen am Rhein', 'Rhineland-Palatinate', 49.470411, 8.438157),
  ('Lübeck', 'Schleswig-Holstein', 53.866444, 10.684738),
  ('Lüneburg', 'Lower Saxony', 53.248706, 10.407855),
  ('Magdeburg', 'Saxony-Anhalt', 52.131478, 11.640079),
  ('Mainz', 'Rhineland-Palatinate', 49.999521, 8.273625),
  ('Mannheim', 'Baden-Württemberg', 49.489291, 8.46731),
  ('Marburg', 'Hesse', 50.809011, 8.77047),
  ('Mittweida', 'Saxony', 50.98546, 12.981046),
  ('Möckern', 'Saxony-Anhalt', 52.140559, 11.952604),
  ('München', 'Bavaria', 48.137108, 11.575382),
  ('Münster', 'North Rhine-Westphalia', 51.96251, 7.625188),
  ('Neu-Ulm', 'Bavaria', 48.395349, 10.000521),
  ('Neubrandenburg', 'Mecklenburg-Vorpommern', 53.557446, 13.260278),
  ('Neuburg an der Donau', 'Bavaria', 48.745628, 11.187962),
  ('Neumarkt in der Oberpfalz', 'Bavaria', 49.280054, 11.458535),
  ('Nordhausen', 'Thuringia', 51.505157, 10.792532),
  ('Nürnberg', 'Bavaria', 49.453872, 11.077298),
  ('Nürtingen', 'Baden-Württemberg', 48.626585, 9.336546),
  ('Oestrich-Winkel', 'Hesse', 50.007186, 8.016758),
  ('Offenburg', 'Baden-Württemberg', 48.469598, 7.942924),
  ('Oldenburg', 'Lower Saxony', 53.138975, 8.214602),
  ('Osnabrück', 'Lower Saxony', 52.27196, 8.047635),
  ('Paderborn', 'North Rhine-Westphalia', 51.717704, 8.752653),
  ('Passau', 'Bavaria', 48.574823, 13.460974),
  ('Pfarrkirchen', 'Bavaria', 48.438569, 12.960861),
  ('Pforzheim', 'Baden-Württemberg', 48.890934, 8.702551),
  ('Pirmasens', 'Rhineland-Palatinate', 49.199696, 7.608785),
  ('Planegg', 'Bavaria', 48.103742, 11.422003),
  ('Potsdam', 'Brandenburg', 52.400931, 13.05914),
  ('Regensburg', 'Bavaria', 49.019533, 12.097487),
  ('Remagen', 'Rhineland-Palatinate', 50.579211, 7.228679),
  ('Reutlingen', 'Baden-Württemberg', 48.491951, 9.211414),
  ('Rheinbach', 'North Rhine-Westphalia', 50.625681, 6.949144),
  ('Riedlingen', 'Baden-Württemberg', 48.153441, 9.47488),
  ('Rosenheim', 'Bavaria', 47.855787, 12.127298),
  ('Rostock', 'Mecklenburg-Vorpommern', 54.088671, 12.140021),
  ('Rottweil', 'Baden-Württemberg', 48.167824, 8.626979),
  ('Rüsselsheim', 'Hesse', 49.994849, 8.411636),
  ('Saarbrücken', 'Saarland', 49.234362, 6.996379),
  ('Sankt Augustin', 'North Rhine-Westphalia', 50.775278, 7.189551),
  ('Schweinfurt', 'Bavaria', 50.045149, 10.234065),
  ('Schwäbisch Gmünd', 'Baden-Württemberg', 48.799904, 9.797758),
  ('Selb', 'Bavaria', 50.169624, 12.13092),
  ('Senftenberg', 'Brandenburg', 51.519201, 14.004654),
  ('Siegen', 'North Rhine-Westphalia', 50.875118, 8.025613),
  ('Sigmaringen', 'Baden-Württemberg', 48.086914, 9.216504),
  ('Soest', 'North Rhine-Westphalia', 51.57255, 8.106126),
  ('Steinfurt', 'North Rhine-Westphalia', 52.137751, 7.35814),
  ('Stralsund', 'Mecklenburg-Vorpommern', 54.309631, 13.082085),
  ('Straubing', 'Bavaria', 48.88198, 12.569716),
  ('Stuttgart', 'Baden-Württemberg', 48.778449, 9.180013),
  ('Tharandt', 'Saxony', 50.985339, 13.579491),
  ('Trier', 'Rhineland-Palatinate', 49.759621, 6.644188),
  ('Tübingen', 'Baden-Württemberg', 48.520326, 9.053596),
  ('Ulm', 'Baden-Württemberg', 48.398497, 9.991246),
  ('Vallendar', 'Rhineland-Palatinate', 50.400138, 7.614248),
  ('Villingen-Schwenningen', 'Baden-Württemberg', 48.063152, 8.492962),
  ('Weiden in der Oberpfalz', 'Bavaria', 49.675275, 12.163164),
  ('Weidenbach', 'Rhineland-Palatinate', 50.154312, 7.883005),
  ('Weimar', 'Thuringia', 50.97933, 11.329792),
  ('Weingarten', 'Baden-Württemberg', 47.80753, 9.643114),
  ('Weißenburg in Bayern', 'Bavaria', 49.030575, 10.971897),
  ('Wernigerode', 'Saxony-Anhalt', 51.834417, 10.786253),
  ('Wiesbaden', 'Hesse', 50.082038, 8.241656),
  ('Wildau', 'Brandenburg', 52.321443, 13.634874),
  ('Wismar', 'Mecklenburg-Vorpommern', 53.890983, 11.464793),
  ('Witten', 'North Rhine-Westphalia', 51.437017, 7.335124),
  ('Witzenhausen', 'Hesse', 51.33319, 9.843419),
  ('Wolfsburg', 'Lower Saxony', 52.420559, 10.786168),
  ('Worms', 'Rhineland-Palatinate', 49.630262, 8.36209),
  ('Wuppertal', 'North Rhine-Westphalia', 51.264018, 7.178037),
  ('Würzburg', 'Bavaria', 49.793372, 9.930978),
  ('Zittau', 'Saxony', 50.909779, 14.800888),
  ('Zweibrücken', 'Rhineland-Palatinate', 49.248655, 7.364198),
  ('Zwickau', 'Saxony', 50.718504, 12.493927)
on conflict (city) do nothing;

-- Public views expose where a program came from.

create or replace view public.v_public_programs with (security_invoker = true) as
select
  p.id, p.slug, p.name, p.degree_type, p.teaching_language,
  p.tuition_fee_eur::float8 as tuition_fee_eur,
  p.application_fee_eur::float8 as application_fee_eur,
  p.ielts_min::float8 as ielts_min,
  p.moi_accepted, p.german_level, p.vpd_required, p.nc_restricted, p.gre_gmat,
  p.portfolio_required, p.application_portal, p.official_url, p.application_url, p.last_verified_at,
  f.slug as field_slug,
  u.id as university_id, u.slug as university_slug, u.name as university_name,
  u.city, u.state as german_state, u.lat::float8 as lat, u.lng::float8 as lng, u.qs_ranking, u.qs_ranking_sort,
  coalesce((
    select array_agg(s.slug order by s.sort_order)
    from public.program_specializations ps
    join public.specializations s on s.id = ps.specialization_id
    where ps.program_id = p.id
  ), '{}') as specialization_slugs,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'season', i.season, 'year', i.academic_year,
      'start', i.application_start, 'end', i.application_end,
      'verified', public.intake_verified(i.needs_review, i.verified_at, p.last_verified_at)
    ) order by i.application_end nulls last)
    from public.program_intakes i
    where i.program_id = p.id
  ), '[]'::jsonb) as intakes,
  p.origin
from public.programs p
join public.universities u on u.id = p.university_id and u.deleted_at is null
join public.fields f on f.id = p.field_id
where p.state = 'published' and p.deleted_at is null;

-- p.* is fixed when a view is created, so recreate it to pick up programs.origin.
drop view public.v_public_program_detail;
create view public.v_public_program_detail with (security_invoker = true) as
select
  p.*,
  f.slug as field_slug, f.name as field_name,
  u.slug as university_slug, u.name as university_name, u.city, u.state as german_state,
  u.lat::float8 as lat, u.lng::float8 as lng, u.qs_ranking, u.website as university_website,
  coalesce((
    select jsonb_agg(jsonb_build_object('kind', h.kind, 'text', h.text) order by h.sort_order)
    from public.program_highlights h where h.program_id = p.id
  ), '[]'::jsonb) as highlights,
  coalesce((
    select jsonb_agg(jsonb_build_object('slug', s.slug, 'name', s.name) order by s.sort_order)
    from public.program_specializations ps
    join public.specializations s on s.id = ps.specialization_id
    where ps.program_id = p.id
  ), '[]'::jsonb) as specializations,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'season', i.season, 'year', i.academic_year, 'start', i.application_start,
      'end', i.application_end, 'eu_end', i.eu_end, 'note', i.note,
      'verified', public.intake_verified(i.needs_review, i.verified_at, p.last_verified_at),
      'verified_at', i.verified_at, 'verified_source', i.verified_source
    ) order by i.application_end nulls last)
    from public.program_intakes i where i.program_id = p.id
  ), '[]'::jsonb) as intakes,
  (select round(avg(r.rating)::numeric, 1) from public.reviews r
    where r.program_id = p.id and r.status = 'approved') as review_avg,
  (select count(*) from public.reviews r
    where r.program_id = p.id and r.status = 'approved') as review_count
from public.programs p
join public.universities u on u.id = p.university_id and u.deleted_at is null
join public.fields f on f.id = p.field_id
where p.state = 'published' and p.deleted_at is null;
grant select on public.v_public_program_detail to anon, authenticated;
revoke insert, update, delete, truncate on public.v_public_program_detail from anon;
