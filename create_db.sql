CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table "user" (
	"id" uuid default uuid_generate_v4(),
	"display_name" varchar(255),
	primary key ("id")
);

create table room (
	"id" uuid default uuid_generate_v4 (),
	"admin_id" uuid not null,
	"name" varchar(255),
	description text,
	primary key ("id"),
	foreign key ("admin_id") references "user" ("id")
);

create table "message" (
	"id" uuid default uuid_generate_v4(),
	"content" text not null,
	"user_id" uuid not null,
	primary key ("id"),
	foreign key ("user_id") references "user" ("id") on delete cascade
);

create table room_message (
	room_id uuid not null,
	message_id uuid not null,
	primary key (room_id, message_id),
	foreign key (room_id) references room ("id") on delete cascade,
	foreign key (message_id) references message ("id") on delete cascade
);
